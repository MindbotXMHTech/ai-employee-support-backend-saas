import { afterEach, describe, expect, it, vi } from "vitest";

type RpcResult = { data: unknown; error: unknown };

const TENANT_ID = "tenant-1";
const UPDATED_AT = "2026-10-28T00:00:00.000Z";

async function loadRepository(rpc: (fn: string, args: Record<string, unknown>) => Promise<RpcResult>) {
  vi.resetModules();
  vi.doMock("@/lib/supabase/server", () => ({
    createSupabaseServiceClient: () => ({
      rpc,
      from: () => {
        throw new Error("direct table access");
      },
    }),
  }));
  return import("./aiSessionQuotaRepository");
}

describe("aiSessionQuotaRepository", () => {
  afterEach(() => {
    vi.doUnmock("@/lib/supabase/server");
    vi.resetModules();
  });

  it("returns the quota row", async () => {
    const rpc = vi.fn(async () => ({
      data: [{ base_limit: 8, base_used: 2, topup_balance: 1, updated_at: UPDATED_AT }],
      error: null,
    }));
    const { getQuota } = await loadRepository(rpc);

    await expect(getQuota(TENANT_ID)).resolves.toEqual({
      base_limit: 8,
      base_used: 2,
      topup_balance: 1,
      updated_at: UPDATED_AT,
    });
    expect(rpc).toHaveBeenCalledWith("get_ai_session_quota", { tenant_id: TENANT_ID });
  });

  it("returns null when the tenant has no quota row", async () => {
    const rpc = vi.fn(async () => ({ data: [], error: null }));
    const { getQuota } = await loadRepository(rpc);

    await expect(getQuota(TENANT_ID)).resolves.toBeNull();
  });

  it("returns consumed_base with the counters from the row", async () => {
    const rpc = vi.fn(async () => ({
      data: [{ outcome: "consumed_base", base_limit: 10, base_used: 1, topup_balance: 4 }],
      error: null,
    }));
    const { consumeSession } = await loadRepository(rpc);

    await expect(consumeSession(TENANT_ID)).resolves.toEqual({
      outcome: "consumed_base",
      base_limit: 10,
      base_used: 1,
      topup_balance: 4,
    });
    expect(rpc).toHaveBeenCalledWith("consume_ai_session", { tenant_id: TENANT_ID });
  });

  it("returns consumed_topup with the counters from the row", async () => {
    const rpc = vi.fn(async () => ({
      data: [{ outcome: "consumed_topup", base_limit: 5, base_used: 5, topup_balance: 2 }],
      error: null,
    }));
    const { consumeSession } = await loadRepository(rpc);

    await expect(consumeSession(TENANT_ID)).resolves.toEqual({
      outcome: "consumed_topup",
      base_limit: 5,
      base_used: 5,
      topup_balance: 2,
    });
  });

  it("maps a missing consume row to exhausted zeros", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: null }));
    const { consumeSession } = await loadRepository(rpc);

    await expect(consumeSession(TENANT_ID)).resolves.toEqual({
      outcome: "exhausted",
      base_limit: 0,
      base_used: 0,
      topup_balance: 0,
    });
  });

  it("throws the consume RPC error", async () => {
    const error = { message: "db down", code: "57014" };
    const rpc = vi.fn(async () => ({ data: null, error }));
    const { consumeSession } = await loadRepository(rpc);

    await expect(consumeSession(TENANT_ID)).rejects.toBe(error);
  });

  it("returns the zero row from upsert", async () => {
    const rpc = vi.fn(async () => ({
      data: [{ base_limit: 0, base_used: 0, topup_balance: 0, updated_at: UPDATED_AT }],
      error: null,
    }));
    const { upsertQuota } = await loadRepository(rpc);

    await expect(upsertQuota(TENANT_ID)).resolves.toEqual({
      base_limit: 0,
      base_used: 0,
      topup_balance: 0,
      updated_at: UPDATED_AT,
    });
    expect(rpc).toHaveBeenCalledWith("upsert_ai_session_quota", { tenant_id: TENANT_ID });
  });

  it("throws when upsert returns no row", async () => {
    const rpc = vi.fn(async () => ({ data: [], error: null }));
    const { upsertQuota } = await loadRepository(rpc);

    await expect(upsertQuota(TENANT_ID)).rejects.toThrow(/missing/);
  });

  it("throws the upsert RPC error", async () => {
    const error = { message: "fk", code: "23503" };
    const rpc = vi.fn(async () => ({ data: null, error }));
    const { upsertQuota } = await loadRepository(rpc);

    await expect(upsertQuota(TENANT_ID)).rejects.toBe(error);
  });

  it("sets base_limit and leaves the other counters to the row", async () => {
    const rpc = vi.fn(async () => ({
      data: [{ base_limit: 12, base_used: 4, topup_balance: 7, updated_at: UPDATED_AT }],
      error: null,
    }));
    const { setBase } = await loadRepository(rpc);

    await expect(setBase(TENANT_ID, 12)).resolves.toEqual({
      base_limit: 12,
      base_used: 4,
      topup_balance: 7,
      updated_at: UPDATED_AT,
    });
    expect(rpc).toHaveBeenCalledWith("set_ai_session_base", {
      tenant_id: TENANT_ID,
      new_base_limit: 12,
    });
  });

  it("adds a topup amount", async () => {
    const rpc = vi.fn(async () => ({
      data: [{ base_limit: 0, base_used: 0, topup_balance: 5, updated_at: UPDATED_AT }],
      error: null,
    }));
    const { addTopup } = await loadRepository(rpc);

    await expect(addTopup(TENANT_ID, 5)).resolves.toMatchObject({ topup_balance: 5 });
    expect(rpc).toHaveBeenCalledWith("add_ai_session_topup", { tenant_id: TENANT_ID, amount: 5 });
  });

  it("resets base_used and sends a new base limit only when one is provided", async () => {
    const rpc = vi.fn(async () => ({
      data: [{ base_limit: 9, base_used: 0, topup_balance: 3, updated_at: UPDATED_AT }],
      error: null,
    }));
    const { resetBase } = await loadRepository(rpc);

    await resetBase(TENANT_ID);
    await resetBase(TENANT_ID, 0);
    expect(rpc).toHaveBeenNthCalledWith(1, "reset_ai_session_base", {
      tenant_id: TENANT_ID,
      new_base_limit: null,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "reset_ai_session_base", {
      tenant_id: TENANT_ID,
      new_base_limit: 0,
    });
  });

  const partnerOp = {
    companyCode: "XAZ342WG",
    op: "reset_base",
    amount: null,
    eventId: "evt-1",
    occurredAt: null,
    updatedBy: null,
  } as const;

  it("applies a partner op through one RPC and returns its outcome and counters", async () => {
    const rpc = vi.fn(async () => ({
      data: [{ outcome: "applied", base_limit: 9, base_used: 0, topup_balance: 3 }],
      error: null,
    }));
    const { applyPartnerOp } = await loadRepository(rpc);

    await expect(applyPartnerOp(partnerOp)).resolves.toEqual({
      outcome: "applied",
      base_limit: 9,
      base_used: 0,
      topup_balance: 3,
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("apply_partner_ai_session_op", {
      p_company_code: "XAZ342WG",
      p_op: "reset_base",
      p_amount: null,
      p_event_id: "evt-1",
      p_occurred_at: null,
      p_updated_by: null,
    });
  });

  it("throws on an unknown partner op outcome", async () => {
    const rpc = vi.fn(async () => ({
      data: [{ outcome: "maybe", base_limit: 0, base_used: 0, topup_balance: 0 }],
      error: null,
    }));
    const { applyPartnerOp } = await loadRepository(rpc);

    await expect(applyPartnerOp(partnerOp)).rejects.toThrow();
  });
});
