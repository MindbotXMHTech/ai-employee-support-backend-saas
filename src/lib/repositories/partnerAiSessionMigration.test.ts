import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PARTNER_AI_SESSION_OP_OUTCOMES, PARTNER_AI_SESSION_OPS } from "@/lib/domain/partnerAiSession";

const migrationPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../supabase/migrations/0009_partner_ai_session_ops.sql",
);

function stripComments(sql: string): string {
  return sql.replace(/--.*$/gm, "");
}

function functionSql(sql: string, name: string): string {
  const startToken = `create or replace function public.${name}`;
  const start = sql.toLowerCase().indexOf(startToken);
  if (start < 0) {
    throw new Error(`Missing function ${name}`);
  }
  const after = sql.slice(start + startToken.length);
  const next = after.search(/create or replace function |^revoke all/im);
  const end = next < 0 ? sql.length : start + startToken.length + next;
  return sql.slice(start, end);
}

function quotedValues(list: string | undefined): string[] {
  return [...(list ?? "").matchAll(/'([a-z_]+)'/g)].map((item) => item[1]);
}

describe("0009_partner_ai_session_ops", () => {
  const sql = stripComments(readFileSync(migrationPath, "utf8"));
  const lower = sql.toLowerCase();
  const applyOp = functionSql(sql, "apply_partner_ai_session_op").toLowerCase();

  it("keeps the outcome domain in step with PARTNER_AI_SESSION_OP_OUTCOMES", () => {
    const match = sql.match(
      /create domain public\.partner_ai_session_op_outcome[\s\S]*?check \(value in \(([^)]+)\)\)/i,
    );
    expect(match).not.toBeNull();
    expect(quotedValues(match?.[1])).toEqual([...PARTNER_AI_SESSION_OP_OUTCOMES]);
  });

  it("keeps the processed event op check in step with PARTNER_AI_SESSION_OPS", () => {
    const match = sql.match(/create table public\.processed_partner_events[\s\S]*?op in \(([^)]+)\)/i);
    expect(match).not.toBeNull();
    expect(quotedValues(match?.[1])).toEqual([...PARTNER_AI_SESSION_OPS]);
  });

  it("claims the event before calling any quota function", () => {
    const claim = applyOp.indexOf("insert into public.processed_partner_events");
    expect(claim).toBeGreaterThan(-1);
    for (const fn of ["set_ai_session_base", "add_ai_session_topup", "reset_ai_session_base"]) {
      const call = applyOp.indexOf(`public.${fn}(`);
      expect(call, fn).toBeGreaterThan(claim);
    }
  });

  it("does not assign topup_balance in apply_partner_ai_session_op", () => {
    expect(applyOp).not.toMatch(/\btopup_balance\s*=/);
    expect(applyOp).not.toMatch(/update\s+public\.tenant_ai_session_quota\b/);
    for (const match of applyOp.matchAll(/insert\s+into\s+public\.tenant_ai_session_quota\b[^;]*?\([^)]*\)/g)) {
      expect(match[0]).not.toMatch(/\btopup_balance\b/);
    }
  });

  it("does not touch monthly_message_limit", () => {
    expect(applyOp.includes("monthly_message_limit")).toBe(false);
  });

  it("does not create a policy", () => {
    expect(lower.includes("create policy")).toBe(false);
  });

  it("revokes table rights on processed_partner_events from service_role", () => {
    expect(lower).toMatch(
      /revoke\s+all\s+on\s+table\s+public\.processed_partner_events\s+from\s+[^;]*\bservice_role\b/,
    );
  });

  it("uses an empty search_path on apply_partner_ai_session_op", () => {
    expect(applyOp).toMatch(/\bsecurity definer\b/);
    expect(applyOp).toContain("set search_path = ''");
  });

  it("does not catch errors inside apply_partner_ai_session_op", () => {
    expect(applyOp).not.toMatch(/\bexception\s+when\b/);
  });

  it("does not revoke execute on the existing quota functions", () => {
    expect(lower).not.toMatch(/revoke[^;]*\bset_ai_session_base\b/);
    expect(lower).not.toMatch(/revoke[^;]*\badd_ai_session_topup\b/);
    expect(lower).not.toMatch(/revoke[^;]*\breset_ai_session_base\b/);
  });
});
