import { afterEach, describe, expect, it, vi } from "vitest";
import { AI_SESSION_NOT_PROVISIONED_MESSAGE } from "@/lib/domain/aiSessionQuota";
import { fakeTenant } from "@/test/fixtures";

const findActiveTenantByCompanyCode = vi.hoisted(() => vi.fn());
const findAiSessionQuota = vi.hoisted(() => vi.fn());
const consumeAiSession = vi.hoisted(() => vi.fn());

describe("executeCentralBotV2Chat", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    findActiveTenantByCompanyCode.mockReset();
    findAiSessionQuota.mockReset();
    consumeAiSession.mockReset();
  });

  async function loadUseCase() {
    vi.doMock("@/lib/services/tenantService", () => ({
      findActiveTenantByCompanyCode,
    }));
    vi.doMock("@/lib/services/aiSessionQuotaService", () => ({
      findAiSessionQuota,
      consumeAiSession,
    }));
    return import("./v2-chat.use-case");
  }

  it("returns 404 without reading sessions when the company code is unknown", async () => {
    findActiveTenantByCompanyCode.mockResolvedValue(null);
    const { executeCentralBotV2Chat } = await loadUseCase();

    const result = await executeCentralBotV2Chat("BADCODE");

    expect(result.statusCode).toBe(404);
    expect(result.body).toEqual({
      success: false,
      error: { code: "INVALID_COMPANY_CODE", message: "Invalid or revoked company code." },
    });
    expect(findAiSessionQuota).not.toHaveBeenCalled();
    expect(consumeAiSession).not.toHaveBeenCalled();
  });

  it("returns the same empty body as usage and does not spend when no session row exists", async () => {
    findActiveTenantByCompanyCode.mockResolvedValue(fakeTenant);
    findAiSessionQuota.mockResolvedValue(null);
    const { executeCentralBotV2Chat } = await loadUseCase();

    const result = await executeCentralBotV2Chat("ABC503");

    expect(result).toEqual({
      statusCode: 200,
      body: { ai_session: null, message: AI_SESSION_NOT_PROVISIONED_MESSAGE },
    });
    expect(consumeAiSession).not.toHaveBeenCalled();
  });

  it("returns remaining zero and does not spend when the row is empty", async () => {
    findActiveTenantByCompanyCode.mockResolvedValue(fakeTenant);
    findAiSessionQuota.mockResolvedValue({
      base_limit: 1,
      base_used: 1,
      topup_balance: 0,
      updated_at: "2026-11-05T00:00:00.000Z",
    });
    const { executeCentralBotV2Chat } = await loadUseCase();

    const result = await executeCentralBotV2Chat("ABC503");

    expect(result).toEqual({
      statusCode: 200,
      body: { ai_session: { base_remaining: 0, topup_balance: 0, remaining: 0 } },
    });
    expect(consumeAiSession).not.toHaveBeenCalled();
  });

  it("spends one session and returns the remaining balance", async () => {
    findActiveTenantByCompanyCode.mockResolvedValue(fakeTenant);
    findAiSessionQuota.mockResolvedValue({
      base_limit: 1,
      base_used: 0,
      topup_balance: 0,
      updated_at: "2026-11-05T00:00:00.000Z",
    });
    consumeAiSession.mockResolvedValue({
      outcome: "consumed_base",
      base_limit: 1,
      base_used: 1,
      topup_balance: 0,
    });
    const { executeCentralBotV2Chat } = await loadUseCase();

    const result = await executeCentralBotV2Chat("ABC503");

    expect(consumeAiSession).toHaveBeenCalledOnce();
    expect(consumeAiSession).toHaveBeenCalledWith(fakeTenant.id);
    expect(result).toEqual({
      statusCode: 200,
      body: { ai_session: { base_remaining: 0, topup_balance: 0, remaining: 0 } },
    });
  });

  it("returns the locked balance when consume finds the row already empty", async () => {
    findActiveTenantByCompanyCode.mockResolvedValue(fakeTenant);
    findAiSessionQuota.mockResolvedValue({
      base_limit: 1,
      base_used: 0,
      topup_balance: 0,
      updated_at: "2026-11-05T00:00:00.000Z",
    });
    consumeAiSession.mockResolvedValue({
      outcome: "exhausted",
      base_limit: 1,
      base_used: 1,
      topup_balance: 0,
    });
    const { executeCentralBotV2Chat } = await loadUseCase();

    const result = await executeCentralBotV2Chat("ABC503");

    expect(result).toEqual({
      statusCode: 200,
      body: { ai_session: { base_remaining: 0, topup_balance: 0, remaining: 0 } },
    });
  });
});
