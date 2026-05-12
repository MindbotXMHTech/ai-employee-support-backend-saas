import { describe, expect, it } from "vitest";
import {
  generateRawWorkflowToken,
  getWorkflowTokenPrefix,
  hashWorkflowToken,
} from "@/lib/services/workflowTokenService";

describe("workflowTokenService", () => {
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
