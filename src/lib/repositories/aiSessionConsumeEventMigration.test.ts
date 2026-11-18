import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { AI_SESSION_CONSUME_EVENT_OUTCOMES } from "@/lib/domain/aiSessionQuota";

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "../../../supabase/migrations");
const domainPath = join(migrationsDir, "0010_consume_ai_session_event.sql");
const migrationPath = join(migrationsDir, "0011_ai_session_events.sql");

function stripComments(sql: string): string {
  return sql.replace(/--.*$/gm, "");
}

function quotedValues(list: string | undefined): string[] {
  return [...(list ?? "").matchAll(/'([a-z_]+)'/g)].map((item) => item[1]);
}

describe("consume_ai_session_event in 0011_ai_session_events", () => {
  const domainSql = stripComments(readFileSync(domainPath, "utf8"));
  const sql = stripComments(readFileSync(migrationPath, "utf8"));
  const lower = sql.toLowerCase();
  const fnStart = lower.indexOf("create or replace function public.consume_ai_session_event");
  const fn = lower.slice(fnStart);

  it("keeps the outcome domain in step with AI_SESSION_CONSUME_EVENT_OUTCOMES", () => {
    const match = domainSql.match(
      /create domain public\.ai_session_consume_event_outcome[\s\S]*?check \(value in \(([^)]+)\)\)/i,
    );
    expect(match).not.toBeNull();
    expect(quotedValues(match?.[1])).toEqual([...AI_SESSION_CONSUME_EVENT_OUTCOMES]);
  });

  it("rejects a blank event id before looking up a company", () => {
    const raise = fn.indexOf("raise exception 'event_id is required'");
    const lookup = fn.indexOf("from public.tenant_company_codes");

    expect(raise).toBeGreaterThan(-1);
    expect(fn).toContain("errcode = '22023'");
    expect(lookup).toBeGreaterThan(raise);
  });

  it("returns company_code_not_found before taking the event lock", () => {
    const missing = fn.indexOf("outcome := 'company_code_not_found'");
    const lock = fn.indexOf("pg_advisory_xact_lock");

    expect(missing).toBeGreaterThan(-1);
    expect(lock).toBeGreaterThan(missing);
  });

  it("returns event_id_conflict for another tenant or op before any spend", () => {
    const distinct = fn.indexOf("v_stored.tenant_id <> v_tenant or v_stored.op <> 'consume'");
    const conflict = fn.indexOf("outcome := 'event_id_conflict'");
    const spend = fn.indexOf("public.consume_ai_session(");

    expect(distinct).toBeGreaterThan(-1);
    expect(conflict).toBeGreaterThan(distinct);
    expect(spend).toBeGreaterThan(conflict);
  });

  it("returns a replay without calling consume_ai_session", () => {
    const replay = fn.indexOf("outcome := 'replayed'");
    const spend = fn.indexOf("public.consume_ai_session(");
    expect(replay).toBeGreaterThan(-1);
    expect(replay).toBeLessThan(spend);
  });

  it("writes a history row with its outcome for every resolved call", () => {
    for (const outcome of ["applied", "replayed", "exhausted", "not_provisioned", "event_id_conflict"]) {
      expect(fn).toMatch(new RegExp(`values \\(p_event_id, v_tenant, 'consume', '${outcome}'`));
    }
  });

  it("lets only an applied row decide replay or conflict", () => {
    const lookup = fn.indexOf("from public.ai_session_events e");
    expect(fn.indexOf("and e.outcome = 'applied'", lookup)).toBeGreaterThan(lookup);
  });

  it("moves the old claim table into the history and drops it", () => {
    expect(lower).toContain("'consume'");
    expect(lower).toContain("drop table public.processed_ai_session_consumes");
  });

  it("grants execute only on the function", () => {
    expect(lower).toMatch(
      /grant execute on function public\.consume_ai_session_event\(text, text\) to service_role/,
    );
  });

  it("uses an empty search_path and does not catch errors", () => {
    expect(fn).toMatch(/\bsecurity definer\b/);
    expect(fn).toContain("set search_path = ''");
    expect(fn).not.toMatch(/\bexception\s+when\b/);
  });
});
