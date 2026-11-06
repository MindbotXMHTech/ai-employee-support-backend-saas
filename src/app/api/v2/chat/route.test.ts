import { afterEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { jsonRequest } from "@/test/mockNextRequest";

const executeCentralBotV2Chat = vi.hoisted(() => vi.fn());

describe("POST /api/v2/chat", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    executeCentralBotV2Chat.mockReset();
  });

  it("rejects requests without a valid central bot secret", async () => {
    vi.doMock("@/lib/api/auth", () => ({
      authenticateCentralBotRequest: vi.fn(async () => ({
        ok: false,
        response: NextResponse.json(
          { success: false, error: { code: "INVALID_API_KEY", message: "Invalid central bot secret." } },
          { status: 401 },
        ),
      })),
    }));
    vi.doMock("@/application/central-bot/v2-chat.use-case", () => ({
      executeCentralBotV2Chat,
    }));

    const { POST } = await import("./route");
    const response = await POST(
      jsonRequest(
        "http://localhost/api/v2/chat",
        {
          company_code: "ABC503",
          event_id: "evt-1",
        },
        { "x-central-bot-secret": "wrong-secret" },
      ),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: { code: "INVALID_API_KEY", message: "Invalid central bot secret." },
    });
    expect(executeCentralBotV2Chat).not.toHaveBeenCalled();
  });

  it("rejects invalid request payloads", async () => {
    vi.doMock("@/lib/api/auth", () => ({
      authenticateCentralBotRequest: vi.fn(async () => ({ ok: true })),
    }));
    vi.doMock("@/application/central-bot/v2-chat.use-case", () => ({
      executeCentralBotV2Chat,
    }));

    const { POST } = await import("./route");
    const response = await POST(
      jsonRequest("http://localhost/api/v2/chat", { company_code: "AB" }, { "x-central-bot-secret": "central-secret" }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toBe("company_code must be at least 4 characters");
    expect(executeCentralBotV2Chat).not.toHaveBeenCalled();
  });

  it("rejects a missing company code before the use case", async () => {
    vi.doMock("@/lib/api/auth", () => ({
      authenticateCentralBotRequest: vi.fn(async () => ({ ok: true })),
    }));
    vi.doMock("@/application/central-bot/v2-chat.use-case", () => ({
      executeCentralBotV2Chat,
    }));

    const { POST } = await import("./route");
    const response = await POST(
      jsonRequest("http://localhost/api/v2/chat", {}, { "x-central-bot-secret": "central-secret" }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "company_code must be at least 4 characters" },
    });
    expect(executeCentralBotV2Chat).not.toHaveBeenCalled();
  });

  it("rejects a missing event id before the use case", async () => {
    vi.doMock("@/lib/api/auth", () => ({
      authenticateCentralBotRequest: vi.fn(async () => ({ ok: true })),
    }));
    vi.doMock("@/application/central-bot/v2-chat.use-case", () => ({
      executeCentralBotV2Chat,
    }));

    const { POST } = await import("./route");
    const response = await POST(
      jsonRequest(
        "http://localhost/api/v2/chat",
        { company_code: "ABC503" },
        { "x-central-bot-secret": "central-secret" },
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "event_id is required" },
    });
    expect(executeCentralBotV2Chat).not.toHaveBeenCalled();
  });

  it("returns 404 from use case when company code is invalid", async () => {
    vi.doMock("@/lib/api/auth", () => ({
      authenticateCentralBotRequest: vi.fn(async () => ({ ok: true })),
    }));
    vi.doMock("@/application/central-bot/v2-chat.use-case", () => ({
      executeCentralBotV2Chat: executeCentralBotV2Chat.mockResolvedValue({
        statusCode: 404,
        body: {
          success: false,
          error: { code: "INVALID_COMPANY_CODE", message: "Invalid or revoked company code." },
        },
      }),
    }));

    const { POST } = await import("./route");
    const response = await POST(
      jsonRequest(
        "http://localhost/api/v2/chat",
        {
          company_code: "BADCODE",
          event_id: "evt-1",
        },
        { "x-central-bot-secret": "central-secret" },
      ),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: { code: "INVALID_COMPANY_CODE", message: "Invalid or revoked company code." },
    });
  });

  it("returns use case response payload and status for valid requests", async () => {
    vi.doMock("@/lib/api/auth", () => ({
      authenticateCentralBotRequest: vi.fn(async () => ({ ok: true })),
    }));
    const sessionBody = { ai_session: { base_remaining: 4, topup_balance: 0, remaining: 4 } };
    executeCentralBotV2Chat.mockResolvedValue({ statusCode: 200, body: sessionBody });
    vi.doMock("@/application/central-bot/v2-chat.use-case", () => ({
      executeCentralBotV2Chat,
    }));

    const { POST } = await import("./route");
    const response = await POST(
      jsonRequest("http://localhost/api/v2/chat", { company_code: "abc503", event_id: " evt-1 " }, {
        "x-central-bot-secret": "central-secret",
      }),
    );

    expect(response.status).toBe(200);
    expect(executeCentralBotV2Chat).toHaveBeenCalledWith("ABC503", "evt-1");
    await expect(response.json()).resolves.toEqual(sessionBody);
  });
});
