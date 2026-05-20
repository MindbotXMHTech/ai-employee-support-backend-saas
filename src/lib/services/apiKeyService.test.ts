import { describe, expect, it, vi } from "vitest";
import { generateRawApiKey, getApiKeyPrefix, hashApiKey } from "@/lib/services/apiKeyService";

describe("apiKeyService", () => {
  it("throws when API_KEY_SECRET is unset", async () => {
    vi.stubEnv("API_KEY_SECRET", "");
    vi.resetModules();
    try {
      const { hashApiKey: hashWithoutSecret } = await import("@/lib/services/apiKeyService");
      expect(() => hashWithoutSecret("aibot_live_test")).toThrow(/API_KEY_SECRET/);
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
  it("generates prefixed raw keys and hashes without storing raw values", () => {
    const rawKey = generateRawApiKey();
    expect(rawKey).toMatch(/^aibot_live_/);
    expect(hashApiKey(rawKey)).toHaveLength(64);
    expect(hashApiKey(rawKey)).not.toBe(rawKey);
  });

  it("creates a display prefix that is not the raw key", () => {
    const rawKey = "aibot_live_abcdefghijklmnopqrstuvwxyz";
    expect(getApiKeyPrefix(rawKey)).toBe("aibot_live_uvwxyz");
  });
});
