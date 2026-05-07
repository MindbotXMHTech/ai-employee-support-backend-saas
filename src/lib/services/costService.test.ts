import { describe, expect, it } from "vitest";
import { calculateCost } from "@/lib/services/costService";

describe("costService", () => {
  it("calculates model cost from input and output token rates", () => {
    expect(
      calculateCost({
        inputTokens: 1_000_000,
        outputTokens: 500_000,
        inputPer1m: 0.25,
        outputPer1m: 2,
      }),
    ).toBe(1.25);
  });
});
