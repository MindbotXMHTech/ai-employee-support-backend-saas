import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeTenant } from "@/test/fixtures";
import { jsonRequest } from "@/test/mockNextRequest";

const executeV1Chat = vi.hoisted(() => vi.fn());

describe("POST /api/v1/chat", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    executeV1Chat.mockReset();
  });

  it("returns the company-code prompt for unresolved central bot users", async () => {
    const promptBody = {
      success: true,
      reply: "กรุณาลงทะเบียนด้วยรหัสบริษัทก่อนใช้งานครับ เพื่อให้ผมผูกบัญชี LINE ของคุณกับบริษัทที่ถูกต้อง",
      message_type: "out_of_scope",
      safety_level: "normal",
      conversation_id: "",
      sources: [],
      handoff_required: false,
      handoff: { enabled: false, url: null, button_text: null, message: null },
      quota: { plan: "trial", used: 0, limit: 0, remaining: 0 },
    };
    executeV1Chat.mockResolvedValue({ statusCode: 200, body: promptBody });

    vi.doMock("@/lib/api/auth", () => ({
      authenticateCentralBotRequest: vi.fn(async () => ({ ok: true })),
      authenticateBotRequest: vi.fn(),
    }));
    vi.doMock("@/lib/services/centralBotService", () => ({
      resolveTenantForCentralBot: vi.fn(async () => ({ ok: false, reason: "unresolved" })),
    }));
    vi.doMock("@/application/chat/v1-chat.use-case", () => ({
      executeV1Chat,
    }));

    const { POST } = await import("./route");
    const response = await POST(jsonRequest(
      "http://localhost/api/v1/chat",
      {
        external_user_id: "line-user-001",
        channel: "line",
        message: "สวัสดี",
      },
      { "x-central-bot-secret": "secret" },
    ));

    expect(response.status).toBe(200);
    expect(executeV1Chat).toHaveBeenCalledTimes(1);
    expect(executeV1Chat).toHaveBeenCalledWith({ kind: "central_needs_company_code" });
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.reply).toContain("รหัสบริษัท");
  });

  it("falls back to legacy API-key auth when central secret is absent", async () => {
    const chatBody = { success: true, reply: "ok" };
    executeV1Chat.mockResolvedValue({ statusCode: 200, body: chatBody });

    const authenticateBotRequest = vi.fn(async () => ({
      ok: true,
      tenant: fakeTenant,
      tenantId: fakeTenant.id,
      apiKeyId: "api-key-id",
    }));
    vi.doMock("@/lib/api/auth", () => ({
      authenticateCentralBotRequest: vi.fn(),
      authenticateBotRequest,
    }));
    vi.doMock("@/lib/services/centralBotService", () => ({
      resolveTenantForCentralBot: vi.fn(),
    }));
    vi.doMock("@/application/chat/v1-chat.use-case", () => ({
      executeV1Chat,
    }));

    const { POST } = await import("./route");
    const payload = {
      external_user_id: "legacy-user-001",
      channel: "api",
      message: "hello",
    };
    const response = await POST(jsonRequest("http://localhost/api/v1/chat", payload));

    expect(response.status).toBe(200);
    expect(authenticateBotRequest).toHaveBeenCalledTimes(1);
    expect(executeV1Chat).toHaveBeenCalledTimes(1);
    expect(executeV1Chat).toHaveBeenCalledWith({
      kind: "chat",
      parsed: expect.objectContaining(payload),
      tenant: fakeTenant,
    });
    await expect(response.json()).resolves.toMatchObject(chatBody);
  });

  it("returns 409 when central bot resolve hits tenant conflict", async () => {
    vi.doMock("@/lib/api/auth", () => ({
      authenticateCentralBotRequest: vi.fn(async () => ({ ok: true })),
      authenticateBotRequest: vi.fn(),
    }));
    vi.doMock("@/lib/services/centralBotService", () => ({
      resolveTenantForCentralBot: vi.fn(async () => ({ ok: false, reason: "tenant_conflict" })),
      buildTenantConflictErrorBody: () => ({
        success: false,
        error: {
          code: "TENANT_CONFLICT",
          message:
            "Unable to link this account. Contact your administrator if you need to change companies.",
        },
      }),
    }));
    vi.doMock("@/application/chat/v1-chat.use-case", () => ({
      executeV1Chat,
    }));

    const { POST } = await import("./route");
    const response = await POST(
      jsonRequest(
        "http://localhost/api/v1/chat",
        {
          external_user_id: "line-user-001",
          channel: "line",
          company_code: "OTHERCO",
          message: "hello",
        },
        { "x-central-bot-secret": "secret" },
      ),
    );

    expect(response.status).toBe(409);
    expect(executeV1Chat).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: { code: "TENANT_CONFLICT" },
    });
  });
});

