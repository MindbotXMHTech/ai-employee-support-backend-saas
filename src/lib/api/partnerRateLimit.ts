/**
 * In-memory sliding-window rate limiter for partner provisioning endpoints.
 * Suitable for single-instance / serverless warm instances; use Redis for multi-region if needed.
 */

import {
  buildPartnerRateLimitKeys,
  consumeRateLimit,
  PARTNER_RATE_LIMIT_MAX_PER_COMPANY_CODE,
  PARTNER_RATE_LIMIT_MAX_PER_IP,
  PARTNER_RATE_LIMIT_WINDOW_MS,
  type RateLimitBucket,
} from "@/lib/api/partnerRateLimitLogic";

const buckets = new Map<string, RateLimitBucket>();

export function checkPartnerProvisionRateLimit(input: {
  ip: string | null;
  companyCode?: string | null;
}): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const { ipKey, companyCodeKey } = buildPartnerRateLimitKeys(input);

  const ipStep = consumeRateLimit(
    buckets.get(ipKey),
    PARTNER_RATE_LIMIT_MAX_PER_IP,
    PARTNER_RATE_LIMIT_WINDOW_MS,
    now,
  );
  buckets.set(ipKey, ipStep.bucket);
  if (!ipStep.ok) return { ok: false, retryAfterSec: ipStep.retryAfterSec };

  if (companyCodeKey) {
    const codeStep = consumeRateLimit(
      buckets.get(companyCodeKey),
      PARTNER_RATE_LIMIT_MAX_PER_COMPANY_CODE,
      PARTNER_RATE_LIMIT_WINDOW_MS,
      now,
    );
    buckets.set(companyCodeKey, codeStep.bucket);
    if (!codeStep.ok) return { ok: false, retryAfterSec: codeStep.retryAfterSec };
  }

  return { ok: true };
}

/** @internal test helper */
export function resetPartnerProvisionRateLimitsForTests() {
  buckets.clear();
}
