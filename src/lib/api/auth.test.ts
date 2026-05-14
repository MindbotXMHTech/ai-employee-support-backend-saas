import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

function centralBotRequest(secret?: string) {
  return new NextRequest("http://localhost/api/v2/chat", {
    headers: secret ? { "x-central-bot-secret": secret } : undefined,
  });
}

describe("bot API auth", () => {
  const originalSecret = process.env.CENTRAL_BOT_SECRET;

  afterEach(() => {
    process.env.CENTRAL_BOT_SECRET = originalSecret;
    vi.resetModules();
  });

  it("rejects missing central bot secret", async () => {
    process.env.CENTRAL_BOT_SECRET = "test-secret";
    const { authenticateCentralBotRequest } = await import("@/lib/api/auth");

    const result = await authenticateCentralBotRequest(centralBotRequest());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
      await expect(result.response.json()).resolves.toEqual({
        success: false,
        error: { code: "INVALID_API_KEY", message: "Invalid central bot secret." },
      });
    }
  });

  it("rejects invalid central bot secret", async () => {
    process.env.CENTRAL_BOT_SECRET = "test-secret";
    const { authenticateCentralBotRequest } = await import("@/lib/api/auth");

    const result = await authenticateCentralBotRequest(centralBotRequest("wrong-secret"));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it("accepts valid central bot secret", async () => {
    process.env.CENTRAL_BOT_SECRET = "test-secret";
    const { authenticateCentralBotRequest } = await import("@/lib/api/auth");

    const result = await authenticateCentralBotRequest(centralBotRequest("test-secret"));

    expect(result).toEqual({ ok: true });
  });
});
