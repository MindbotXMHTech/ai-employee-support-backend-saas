import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeChatResponse, fakeTenant } from "@/test/fixtures";

describe("executeCentralBotV2Chat", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("returns 404 without calling orchestration when company code is invalid", async () => {
    const handleChatRequest = vi.fn();
    vi.doMock("@/lib/services/centralBotService", () => ({
      registerEmployeeTenantLink: vi.fn(async () => null),
    }));
    vi.doMock("@/lib/services/aiService", () => ({
      handleChatRequest,
    }));

    const { executeCentralBotV2Chat } = await import("./v2-chat.use-case");
    const result = await executeCentralBotV2Chat({
      user_id: "line-user-001",
      message: "อยากได้กำลังใจ",
      company_code: "BADCODE",
    });

    expect(result.statusCode).toBe(404);
    expect(result.body).toEqual({
      success: false,
      error: { code: "INVALID_COMPANY_CODE", message: "Invalid or revoked company code." },
    });
    expect(handleChatRequest).not.toHaveBeenCalled();
  });

  it("registers tenant link then delegates chat with stable conversation id shape", async () => {
    const handleChatRequest = vi.fn(async () => fakeChatResponse);
    const registerEmployeeTenantLink = vi.fn(async () => ({ tenant: fakeTenant }));
    vi.doMock("@/lib/services/centralBotService", () => ({
      registerEmployeeTenantLink,
    }));
    vi.doMock("@/lib/services/aiService", () => ({
      handleChatRequest,
    }));

    const { CENTRAL_BOT_V2_CHANNEL, CENTRAL_BOT_V2_METADATA_SOURCE, executeCentralBotV2Chat } = await import(
      "./v2-chat.use-case"
    );
    const result = await executeCentralBotV2Chat({
      user_id: "line-user-001",
      message: "อยากได้กำลังใจ",
      company_code: "ABC503",
    });

    expect(result.statusCode).toBe(200);
    expect(registerEmployeeTenantLink).toHaveBeenCalledWith({
      externalUserId: "line-user-001",
      channel: CENTRAL_BOT_V2_CHANNEL,
      companyCode: "ABC503",
      metadata: { source: CENTRAL_BOT_V2_METADATA_SOURCE },
    });
    expect(handleChatRequest).toHaveBeenCalledWith({
      external_user_id: "line-user-001",
      channel: CENTRAL_BOT_V2_CHANNEL,
      message: "อยากได้กำลังใจ",
      company_code: "ABC503",
      conversation_id: "v2:ABC503:line-user-001",
      metadata: { source: CENTRAL_BOT_V2_METADATA_SOURCE },
      tenant: fakeTenant,
    });
    expect(result.body).toEqual(fakeChatResponse);
  });

  it("returns 409 when employee is already linked to another tenant", async () => {
    const handleChatRequest = vi.fn();
    vi.doMock("@/lib/services/centralBotService", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/lib/services/centralBotService")>();
      return {
        ...actual,
        registerEmployeeTenantLink: vi.fn(async () => {
          throw new actual.TenantConflictError();
        }),
      };
    });
    vi.doMock("@/lib/services/aiService", () => ({
      handleChatRequest,
    }));

    const { executeCentralBotV2Chat } = await import("./v2-chat.use-case");
    const result = await executeCentralBotV2Chat({
      user_id: "line-user-001",
      message: "hello",
      company_code: "OTHERCO",
    });

    expect(result.statusCode).toBe(409);
    expect(result.body).toEqual({
      success: false,
      error: {
        code: "TENANT_CONFLICT",
        message:
          "Unable to link this account. Contact your administrator if you need to change companies.",
      },
    });
    expect(handleChatRequest).not.toHaveBeenCalled();
  });

  it("maps orchestration failures to HTTP 400 while preserving ChatApi payload", async () => {
    const handleChatRequest = vi.fn(async () => ({
      success: false,
      error: { code: "TENANT_SUSPENDED" as const, message: "Tenant suspended." },
    }));
    vi.doMock("@/lib/services/centralBotService", () => ({
      registerEmployeeTenantLink: vi.fn(async () => ({ tenant: fakeTenant })),
    }));
    vi.doMock("@/lib/services/aiService", () => ({
      handleChatRequest,
    }));

    const { executeCentralBotV2Chat } = await import("./v2-chat.use-case");
    const result = await executeCentralBotV2Chat({
      user_id: "user-2",
      message: "hi",
      company_code: "XYZ",
    });

    expect(result.statusCode).toBe(400);
    expect(result.body).toMatchObject({
      success: false,
      error: { code: "TENANT_SUSPENDED", message: "Tenant suspended." },
    });
  });
});
