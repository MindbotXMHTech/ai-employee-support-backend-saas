import { describe, expect, it } from "vitest";
import { generateRawApiKey, getApiKeyPrefix, hashApiKey } from "@/lib/services/apiKeyService";

describe("apiKeyService", () => {
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
