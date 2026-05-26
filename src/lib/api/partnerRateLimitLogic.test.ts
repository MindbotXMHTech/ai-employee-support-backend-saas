import { describe, expect, it } from "vitest";
import {
  buildPartnerRateLimitKeys,
  consumeRateLimit,
  PARTNER_RATE_LIMIT_MAX_PER_COMPANY_CODE,
  PARTNER_RATE_LIMIT_MAX_PER_IP,
  PARTNER_RATE_LIMIT_WINDOW_MS,
} from "./partnerRateLimitLogic";
import {
  checkPartnerProvisionRateLimit,
  resetPartnerProvisionRateLimitsForTests,
} from "./partnerRateLimit";

describe("consumeRateLimit", () => {
  const windowMs = PARTNER_RATE_LIMIT_WINDOW_MS;
  const max = 3;

  it("creates a new bucket when none exists", () => {
    const result = consumeRateLimit(undefined, max, windowMs, 1000);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.bucket).toEqual({ count: 1, resetAt: 1000 + windowMs });
    }
  });

  it("creates a new bucket when window expired", () => {
    const result = consumeRateLimit({ count: 3, resetAt: 500 }, max, windowMs, 1000);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.bucket.count).toBe(1);
      expect(result.bucket.resetAt).toBe(1000 + windowMs);
    }
  });

  it("increments count within window", () => {
    const first = consumeRateLimit(undefined, max, windowMs, 1000);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = consumeRateLimit(first.bucket, max, windowMs, 1100);
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.bucket.count).toBe(2);
      expect(second.bucket.resetAt).toBe(first.bucket.resetAt);
    }
  });

  it("rejects when max exceeded", () => {
    const result = consumeRateLimit({ count: 3, resetAt: 5000 }, max, windowMs, 1000);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.retryAfterSec).toBe(4);
    }
  });
});

describe("buildPartnerRateLimitKeys", () => {
  it("normalizes ip and company code keys", () => {
    expect(
      buildPartnerRateLimitKeys({ ip: " 1.2.3.4 ", companyCode: "  acme01 " }),
    ).toEqual({
      ipKey: "partner:ip:1.2.3.4",
      companyCodeKey: "partner:code:ACME01",
    });
  });

  it("uses unknown ip and null company key when empty", () => {
    expect(buildPartnerRateLimitKeys({ ip: null, companyCode: "  " })).toEqual({
      ipKey: "partner:ip:unknown",
      companyCodeKey: null,
    });
  });
});

describe("checkPartnerProvisionRateLimit", () => {
  it("allows requests under per-ip and per-code limits", () => {
    resetPartnerProvisionRateLimitsForTests();
    for (let i = 0; i < PARTNER_RATE_LIMIT_MAX_PER_COMPANY_CODE; i++) {
      expect(
        checkPartnerProvisionRateLimit({ ip: "10.0.0.1", companyCode: "ACME01" }),
      ).toEqual({ ok: true });
    }
  });

  it("rate limits by company code after max per code", () => {
    resetPartnerProvisionRateLimitsForTests();
    for (let i = 0; i < PARTNER_RATE_LIMIT_MAX_PER_COMPANY_CODE; i++) {
      checkPartnerProvisionRateLimit({ ip: `10.0.0.${i}`, companyCode: "ACME01" });
    }
    const blocked = checkPartnerProvisionRateLimit({ ip: "10.0.0.99", companyCode: "ACME01" });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.retryAfterSec).toBeGreaterThan(0);
    }
  });

  it("rate limits by ip across different company codes", () => {
    resetPartnerProvisionRateLimitsForTests();
    for (let i = 0; i < PARTNER_RATE_LIMIT_MAX_PER_IP; i++) {
      expect(
        checkPartnerProvisionRateLimit({ ip: "203.0.113.1", companyCode: `CODE${i}` }),
      ).toEqual({ ok: true });
    }
    const blocked = checkPartnerProvisionRateLimit({ ip: "203.0.113.1", companyCode: "NEWCODE" });
    expect(blocked.ok).toBe(false);
  });
});
