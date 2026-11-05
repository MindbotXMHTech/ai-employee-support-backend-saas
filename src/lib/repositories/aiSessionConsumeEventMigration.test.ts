import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { AI_SESSION_CONSUME_EVENT_OUTCOMES } from "@/lib/domain/aiSessionQuota";

const migrationPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../supabase/migrations/0010_consume_ai_session_event.sql",
);

function stripComments(sql: string): string {
  return sql.replace(/--.*$/gm, "");
}

function quotedValues(list: string | undefined): string[] {
  return [...(list ?? "").matchAll(/'([a-z_]+)'/g)].map((item) => item[1]);
}

describe("0010_consume_ai_session_event", () => {
  const sql = stripComments(readFileSync(migrationPath, "utf8"));
  const lower = sql.toLowerCase();
  const fnStart = lower.indexOf("create or replace function public.consume_ai_session_event");
  const fn = lower.slice(fnStart);

  it("keeps the outcome domain in step with AI_SESSION_CONSUME_EVENT_OUTCOMES", () => {
    const match = sql.match(
      /create domain public\.ai_session_consume_event_outcome[\s\S]*?check \(value in \(([^)]+)\)\)/i,
    );
    expect(match).not.toBeNull();
    expect(quotedValues(match?.[1])).toEqual([...AI_SESSION_CONSUME_EVENT_OUTCOMES]);
  });

  it("claims the event before consume_ai_session", () => {
    const claim = fn.indexOf("insert into public.processed_ai_session_consumes");
    const spend = fn.indexOf("public.consume_ai_session(");
    expect(claim).toBeGreaterThan(-1);
    expect(spend).toBeGreaterThan(claim);
  });

  it("returns a replay without calling consume_ai_session", () => {
    const replay = fn.indexOf("outcome := 'replayed'");
    const spend = fn.indexOf("public.consume_ai_session(");
    expect(replay).toBeGreaterThan(-1);
    expect(replay).toBeLessThan(spend);
  });

  it("revokes table rights from service_role and grants execute only on the function", () => {
    expect(lower).toMatch(
      /revoke\s+all\s+on\s+table\s+public\.processed_ai_session_consumes\s+from\s+[^;]*\bservice_role\b/,
    );
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
