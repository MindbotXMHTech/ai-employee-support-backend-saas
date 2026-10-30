import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { AI_SESSION_CONSUME_OUTCOMES } from "@/lib/domain/aiSessionQuota";

const migrationPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../supabase/migrations/0008_tenant_ai_session_quota.sql",
);

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

function assignsTopupBalance(body: string): boolean {
  const code = body.replace(/--.*$/gm, "");
  if (/\btopup_balance\s*=/.test(code)) return true;
  for (const match of code.matchAll(
    /insert\s+into\s+public\.tenant_ai_session_quota\b[^;]*?\([^)]*\)/gi,
  )) {
    if (/\btopup_balance\b/.test(match[0])) return true;
  }
  return false;
}

describe("0008_tenant_ai_session_quota", () => {
  const sql = readFileSync(migrationPath, "utf8");

  it("does not create a policy", () => {
    expect(sql.toLowerCase().includes("create policy")).toBe(false);
  });

  it("revokes table rights from service_role", () => {
    expect(sql.toLowerCase()).toMatch(
      /revoke\s+all\s+on\s+table\s+public\.tenant_ai_session_quota\s+from\s+[^;]*\bservice_role\b/,
    );
  });

  it("locks the quota row in consume_ai_session", () => {
    expect(functionSql(sql, "consume_ai_session").toLowerCase()).toMatch(/\bfor\s+update\b/);
  });

  it("does not assign topup_balance from set_ai_session_base or reset_ai_session_base", () => {
    expect(assignsTopupBalance(functionSql(sql, "add_ai_session_topup"))).toBe(true);
    expect(assignsTopupBalance(functionSql(sql, "set_ai_session_base"))).toBe(false);
    expect(assignsTopupBalance(functionSql(sql, "reset_ai_session_base"))).toBe(false);
  });

  it("clears base usage and replaces the base limit only when a new limit is passed", () => {
    const body = functionSql(sql, "reset_ai_session_base").replace(/--.*$/gm, "").toLowerCase();
    expect(body).toMatch(/base_used\s*=\s*0/);
    expect(body).toMatch(/when reset_ai_session_base\.new_base_limit is null then q\.base_limit/);
    expect(body).toMatch(/else reset_ai_session_base\.new_base_limit/);
  });

  it("uses an empty search_path on every security definer function", () => {
    const code = sql.replace(/--.*$/gm, "");
    expect(code.includes("search_path = public")).toBe(false);
    expect(code.match(/set search_path = ''/g)).toHaveLength(6);
    expect(code.match(/\bsecurity definer\b/g)).toHaveLength(6);
  });

  it("names the primary key in ON CONFLICT so the tenant_id argument stays unambiguous", () => {
    const code = sql.replace(/--.*$/gm, "").toLowerCase();
    expect(code).not.toMatch(/on conflict\s*\(\s*tenant_id\s*\)/);
    expect(code.match(/on conflict on constraint tenant_ai_session_quota_pkey/g)).toHaveLength(4);
  });

  it("keeps the consume outcome domain in step with AI_SESSION_CONSUME_OUTCOMES", () => {
    const match = sql.match(
      /create domain public\.ai_session_consume_outcome[\s\S]*?check \(value in \(([^)]+)\)\)/i,
    );
    expect(match).not.toBeNull();
    const values = [...(match?.[1] ?? "").matchAll(/'([a-z_]+)'/g)].map((item) => item[1]);
    expect(values).toEqual([...AI_SESSION_CONSUME_OUTCOMES]);
  });
});
