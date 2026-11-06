import { afterEach, describe, expect, it, vi } from "vitest";
import { AI_SESSION_NOT_PROVISIONED_MESSAGE } from "@/lib/domain/aiSessionQuota";

const consumeAiSessionEvent = vi.hoisted(() => vi.fn());

describe("executeCentralBotV2Chat", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    consumeAiSessionEvent.mockReset();
  });

  async function loadUseCase() {
    vi.doMock("@/lib/services/aiSessionQuotaService", () => ({
      consumeAiSessionEvent,
    }));
    return import("./v2-chat.use-case");
  }

  it("returns 404 when the company code is unknown and does not describe a spend", async () => {
    consumeAiSessionEvent.mockResolvedValue({
      outcome: "company_code_not_found",
      base_limit: 0,
      base_used: 0,
      topup_balance: 0,
    });
    const { executeCentralBotV2Chat } = await loadUseCase();

    const result = await executeCentralBotV2Chat("BADCODE", "evt-1");

    expect(result.statusCode).toBe(404);
    expect(result.body).toEqual({
      success: false,
      error: { code: "INVALID_COMPANY_CODE", message: "Invalid or revoked company code." },
    });
    expect(consumeAiSessionEvent).toHaveBeenCalledWith("BADCODE", "evt-1");
  });

  it("returns no session row and outcome not_provisioned when the row is missing", async () => {
    consumeAiSessionEvent.mockResolvedValue({
      outcome: "not_provisioned",
      base_limit: 0,
      base_used: 0,
      topup_balance: 0,
    });
    const { executeCentralBotV2Chat } = await loadUseCase();

    await expect(executeCentralBotV2Chat("ABC503", "evt-1")).resolves.toEqual({
      statusCode: 200,
      body: { ai_session: null, message: AI_SESSION_NOT_PROVISIONED_MESSAGE, outcome: "not_provisioned" },
    });
  });

  it("returns remaining zero when the row is empty", async () => {
    consumeAiSessionEvent.mockResolvedValue({
      outcome: "exhausted",
      base_limit: 1,
      base_used: 1,
      topup_balance: 0,
    });
    const { executeCentralBotV2Chat } = await loadUseCase();

    await expect(executeCentralBotV2Chat("ABC503", "evt-1")).resolves.toEqual({
      statusCode: 200,
      body: { ai_session: { base_remaining: 0, topup_balance: 0, remaining: 0 }, outcome: "exhausted" },
    });
  });

  it("returns the balance from one claimed spend", async () => {
    consumeAiSessionEvent.mockResolvedValue({
      outcome: "applied",
      base_limit: 1,
      base_used: 1,
      topup_balance: 0,
    });
    const { executeCentralBotV2Chat } = await loadUseCase();

    const result = await executeCentralBotV2Chat("ABC503", "evt-1");

    expect(consumeAiSessionEvent).toHaveBeenCalledOnce();
    expect(result).toEqual({
      statusCode: 200,
      body: { ai_session: { base_remaining: 0, topup_balance: 0, remaining: 0 }, outcome: "applied" },
    });
  });

  it("returns the current balance when the same event_id is replayed", async () => {
    consumeAiSessionEvent.mockResolvedValue({
      outcome: "replayed",
      base_limit: 4,
      base_used: 1,
      topup_balance: 2,
    });
    const { executeCentralBotV2Chat } = await loadUseCase();

    await expect(executeCentralBotV2Chat("ABC503", "evt-1")).resolves.toEqual({
      statusCode: 200,
      body: { ai_session: { base_remaining: 3, topup_balance: 2, remaining: 5 }, outcome: "replayed" },
    });
    expect(consumeAiSessionEvent).toHaveBeenCalledOnce();
  });

  it("returns 409 when the event_id belongs to another company", async () => {
    consumeAiSessionEvent.mockResolvedValue({
      outcome: "event_id_conflict",
      base_limit: 0,
      base_used: 0,
      topup_balance: 0,
    });
    const { executeCentralBotV2Chat } = await loadUseCase();

    const result = await executeCentralBotV2Chat("OTHER1", "evt-1");

    expect(result).toEqual({
      statusCode: 409,
      body: {
        success: false,
        error: {
          code: "EVENT_ID_CONFLICT",
          message: "event_id was already used for a different company.",
        },
      },
    });
  });
});
