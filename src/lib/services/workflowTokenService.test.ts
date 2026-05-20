import { describe, expect, it, vi } from "vitest";
import {
  generateRawWorkflowToken,
  getWorkflowTokenPrefix,
  hashWorkflowToken,
} from "@/lib/services/workflowTokenService";

describe("workflowTokenService", () => {
  it("throws when API_KEY_SECRET is unset", async () => {
    vi.stubEnv("API_KEY_SECRET", "");
    vi.resetModules();
    try {
      const { hashWorkflowToken: hashWithoutSecret } = await import("@/lib/services/workflowTokenService");
      expect(() => hashWithoutSecret("wf_live_test")).toThrow(/API_KEY_SECRET/);
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
  it("generates prefixed raw tokens and hashes without storing raw values", () => {
    const rawKey = generateRawWorkflowToken();
    expect(rawKey).toMatch(/^wf_live_/);
    expect(hashWorkflowToken(rawKey)).toHaveLength(64);
    expect(hashWorkflowToken(rawKey)).not.toBe(rawKey);
  });

  it("creates a display prefix that is not the raw key", () => {
    const rawKey = "wf_live_abcdefghijklmnopqrstuvwxyz";
    expect(getWorkflowTokenPrefix(rawKey)).toBe("wf_live_uvwxyz");
  });
});
