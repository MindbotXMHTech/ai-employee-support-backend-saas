import { createSupabaseServiceClient } from "@/lib/supabase/server";
import {
  AI_SESSION_CONSUME_OUTCOMES,
  type AiSessionConsumeOutcome,
  type AiSessionConsumeResult,
  type AiSessionQuota,
  type AiSessionQuotaCounters,
} from "@/lib/domain/aiSessionQuota";

const POSTGRES_INT_MAX = 2_147_483_647;

const RPC = {
  getQuota: "get_ai_session_quota",
  upsertQuota: "upsert_ai_session_quota",
  consumeSession: "consume_ai_session",
  setBase: "set_ai_session_base",
  addTopup: "add_ai_session_topup",
  resetBase: "reset_ai_session_base",
} as const;

export async function getQuota(tenantId: string): Promise<AiSessionQuota | null> {
  const rows = rowsOf(await callRpc(RPC.getQuota, { tenant_id: tenantId }));
  if (rows.length === 0) return null;
  return parseQuotaRow(onlyRow(rows));
}

export async function upsertQuota(tenantId: string): Promise<AiSessionQuota> {
  return parseQuotaRow(onlyRow(rowsOf(await callRpc(RPC.upsertQuota, { tenant_id: tenantId }))));
}

export async function consumeSession(tenantId: string): Promise<AiSessionConsumeResult> {
  const rows = rowsOf(await callRpc(RPC.consumeSession, { tenant_id: tenantId }));
  // An empty payload means the tenant has no row. This branch returns exhausted and writes nothing.
  if (rows.length === 0) {
    return { outcome: "exhausted", base_limit: 0, base_used: 0, topup_balance: 0 };
  }
  return parseConsumeRow(onlyRow(rows));
}

export async function setBase(tenantId: string, baseLimit: number): Promise<AiSessionQuota> {
  return parseQuotaRow(
    onlyRow(
      rowsOf(await callRpc(RPC.setBase, { tenant_id: tenantId, new_base_limit: baseLimit })),
    ),
  );
}

export async function addTopup(tenantId: string, amount: number): Promise<AiSessionQuota> {
  return parseQuotaRow(
    onlyRow(rowsOf(await callRpc(RPC.addTopup, { tenant_id: tenantId, amount }))),
  );
}

export async function resetBase(tenantId: string, baseLimit?: number): Promise<AiSessionQuota> {
  return parseQuotaRow(
    onlyRow(
      rowsOf(
        await callRpc(RPC.resetBase, {
          tenant_id: tenantId,
          new_base_limit: baseLimit ?? null,
        }),
      ),
    ),
  );
}

async function callRpc(fn: string, args: Record<string, unknown>): Promise<unknown> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data;
}

function rowsOf(data: unknown): unknown[] {
  if (data == null) return [];
  if (Array.isArray(data)) return data;
  throw new Error("Unexpected AI session quota RPC payload");
}

function onlyRow(rows: unknown[]): unknown {
  if (rows.length === 0) {
    throw new Error("AI session quota row is missing");
  }
  if (rows.length !== 1) {
    throw new Error("Expected one AI session quota row");
  }
  return rows[0];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function recordOf(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error("Invalid AI session quota row");
  }
  return value;
}

function parseCounter(value: unknown, field: string): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > POSTGRES_INT_MAX
  ) {
    throw new Error(`Invalid ${field}`);
  }
  return value;
}

function parseCounters(row: Record<string, unknown>): AiSessionQuotaCounters {
  return {
    base_limit: parseCounter(row.base_limit, "base_limit"),
    base_used: parseCounter(row.base_used, "base_used"),
    topup_balance: parseCounter(row.topup_balance, "topup_balance"),
  };
}

function parseOutcome(value: unknown): AiSessionConsumeOutcome {
  for (const outcome of AI_SESSION_CONSUME_OUTCOMES) {
    if (value === outcome) return outcome;
  }
  throw new Error("Invalid AI session consume outcome");
}

function parseQuotaRow(value: unknown): AiSessionQuota {
  const row = recordOf(value);
  if (typeof row.updated_at !== "string" || row.updated_at.length === 0) {
    throw new Error("Invalid updated_at");
  }
  return { ...parseCounters(row), updated_at: row.updated_at };
}

function parseConsumeRow(value: unknown): AiSessionConsumeResult {
  const row = recordOf(value);
  return { outcome: parseOutcome(row.outcome), ...parseCounters(row) };
}
