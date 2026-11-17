import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../supabase/migrations/0011_ai_session_events.sql",
);

function stripComments(sql: string): string {
  return sql.replace(/--.*$/gm, "");
}

describe("0011_ai_session_events", () => {
  const lower = stripComments(readFileSync(migrationPath, "utf8")).toLowerCase();

  it("rebuilds the table with the agreed column order and id as primary key", () => {
    const create = lower.match(/create table public\.ai_session_events \(([\s\S]*?)\n\);/);
    expect(create).not.toBeNull();
    const columns = [...(create?.[1] ?? "").matchAll(/^\s{2}([a-z_]+) /gm)].map((m) => m[1]);
    expect(columns).toEqual([
      "id",
      "event_id",
      "tenant_id",
      "op",
      "outcome",
      "amount",
      "delta",
      "base_limit",
      "base_used",
      "topup_balance",
      "topup_used",
      "remaining",
      "created_at",
    ]);
    expect(lower).toMatch(/id uuid not null default gen_random_uuid\(\) constraint ai_session_events_pkey primary key/);
  });

  it("does not make event_id unique", () => {
    expect(lower).not.toMatch(/\bunique\b/);
    expect(lower).not.toMatch(/primary key \(event_id\)/);
  });

  it("does not use on conflict", () => {
    expect(lower).not.toMatch(/\bon\s+conflict\b/);
  });

  it("has created_at and no updated_at", () => {
    expect(lower).toMatch(/created_at timestamptz not null default now\(\)/);
    expect(lower).not.toMatch(/\bupdated_at\b/);
  });

  it("stores delta as a bigint column", () => {
    expect(lower).toMatch(/\n  delta bigint not null,/);
  });

  it("generates remaining as a stored bigint", () => {
    expect(lower).toMatch(
      /remaining bigint generated always as \(greatest\(base_limit - base_used, 0\)::bigint \+ topup_balance\) stored/,
    );
  });
});
