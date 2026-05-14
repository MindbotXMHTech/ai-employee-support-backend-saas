import { afterEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { fakeChatResponse } from "@/test/fixtures";
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
          user_id: "line-user-001",
          message: "hi",
          company_code: "ABC503",
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
    const response = await POST(jsonRequest("http://localhost/api/v2/chat", { user_id: "user-1" }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
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
          user_id: "line-user-001",
          message: "อยากได้กำลังใจ",
          company_code: "BADCODE",
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
    executeCentralBotV2Chat.mockResolvedValue({ statusCode: 200, body: fakeChatResponse });
    vi.doMock("@/application/central-bot/v2-chat.use-case", () => ({
      executeCentralBotV2Chat,
    }));

    const { POST } = await import("./route");
    const payload = {
      user_id: "line-user-001",
      message: "อยากได้กำลังใจ",
      company_code: "ABC503",
    };
    const response = await POST(
      jsonRequest("http://localhost/api/v2/chat", payload, {
        "x-central-bot-secret": "central-secret",
      }),
    );

    expect(response.status).toBe(200);
    expect(executeCentralBotV2Chat).toHaveBeenCalledWith(payload);
    await expect(response.json()).resolves.toEqual(fakeChatResponse);
  });
});
