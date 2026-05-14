import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatRequestInput } from "@/lib/validation/chat";
import { fakeTenant } from "@/test/fixtures";

const handleChatRequest = vi.fn();
const centralBotNeedsCompanyCodeResponse = vi.fn();

vi.mock("@/lib/services/aiService", () => ({
  handleChatRequest,
}));

vi.mock("@/lib/services/centralBotService", () => ({
  centralBotNeedsCompanyCodeResponse,
}));

describe("executeV1Chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns centralized company-code guidance without touching AI orchestration", async () => {
    const promptBody = {
      success: true as const,
      reply: "กรุณาลงทะเบียน",
      message_type: "out_of_scope" as const,
      safety_level: "normal" as const,
      conversation_id: "",
      sources: [],
      handoff_required: false,
      handoff: { enabled: false, url: null, button_text: null, message: null },
      quota: { plan: "trial" as const, used: 0, limit: 0, remaining: 0 },
    };
    centralBotNeedsCompanyCodeResponse.mockReturnValue(promptBody);

    const { executeV1Chat } = await import("./v1-chat.use-case");
    const result = await executeV1Chat({ kind: "central_needs_company_code" });

    expect(centralBotNeedsCompanyCodeResponse).toHaveBeenCalledTimes(1);
    expect(handleChatRequest).not.toHaveBeenCalled();
    expect(result).toEqual({ statusCode: 200, body: promptBody });
  });

  it("delegates authenticated chat with tenant-bound payload", async () => {
    handleChatRequest.mockResolvedValue({ success: true, reply: "hi" });
    const parsed: ChatRequestInput = {
      external_user_id: "u1",
      channel: "line",
      message: "hello",
    };

    const { executeV1Chat } = await import("./v1-chat.use-case");
    const result = await executeV1Chat({ kind: "chat", parsed, tenant: fakeTenant });

    expect(handleChatRequest).toHaveBeenCalledWith({ ...parsed, tenant: fakeTenant });
    expect(result.statusCode).toBe(200);
    expect(result.body).toMatchObject({ success: true, reply: "hi" });
  });

  it("maps unsuccessful orchestration to HTTP 400", async () => {
    handleChatRequest.mockResolvedValue({
      success: false,
      error: { code: "QUOTA_EXCEEDED", message: "limit" },
    });
    const parsed: ChatRequestInput = {
      external_user_id: "u1",
      channel: "line",
      message: "hello",
    };

    const { executeV1Chat } = await import("./v1-chat.use-case");
    const result = await executeV1Chat({ kind: "chat", parsed, tenant: fakeTenant });

    expect(result.statusCode).toBe(400);
    expect(result.body).toEqual({
      success: false,
      error: { code: "QUOTA_EXCEEDED", message: "limit" },
    });
  });
});
