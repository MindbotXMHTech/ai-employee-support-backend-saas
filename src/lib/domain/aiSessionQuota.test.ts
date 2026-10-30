import { describe, expect, it } from "vitest";
import { computeSessionAvailability } from "./aiSessionQuota";

describe("computeSessionAvailability", () => {
  it("returns zeros when every counter is zero", () => {
    expect(
      computeSessionAvailability({ base_limit: 0, base_used: 0, topup_balance: 0 }),
    ).toEqual({
      baseRemaining: 0,
      topupRemaining: 0,
      remaining: 0,
    });
  });

  it("counts unused base when there is no topup", () => {
    expect(
      computeSessionAvailability({ base_limit: 10, base_used: 3, topup_balance: 0 }),
    ).toEqual({
      baseRemaining: 7,
      topupRemaining: 0,
      remaining: 7,
    });
  });

  it("counts topup when base is used up", () => {
    expect(
      computeSessionAvailability({ base_limit: 5, base_used: 5, topup_balance: 2 }),
    ).toEqual({
      baseRemaining: 0,
      topupRemaining: 2,
      remaining: 2,
    });
  });

  it("adds remaining base and topup", () => {
    expect(
      computeSessionAvailability({ base_limit: 10, base_used: 4, topup_balance: 3 }),
    ).toEqual({
      baseRemaining: 6,
      topupRemaining: 3,
      remaining: 9,
    });
  });

  it("keeps topup when base_used is above base_limit", () => {
    expect(
      computeSessionAvailability({ base_limit: 4, base_used: 9, topup_balance: 3 }),
    ).toEqual({
      baseRemaining: 0,
      topupRemaining: 3,
      remaining: 3,
    });
  });
});
