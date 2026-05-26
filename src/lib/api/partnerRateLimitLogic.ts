/** Pure sliding-window rate limit step — testable without module-level Map state. */

export type RateLimitBucket = { count: number; resetAt: number };

export type RateLimitConsumeResult =
  | { ok: true; bucket: RateLimitBucket }
  | { ok: false; bucket: RateLimitBucket; retryAfterSec: number };

export function consumeRateLimit(
  existing: RateLimitBucket | undefined,
  max: number,
  windowMs: number,
  now: number,
): RateLimitConsumeResult {
  if (!existing || now >= existing.resetAt) {
    return { ok: true, bucket: { count: 1, resetAt: now + windowMs } };
  }
  if (existing.count >= max) {
    return {
      ok: false,
      bucket: existing,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  return {
    ok: true,
    bucket: { count: existing.count + 1, resetAt: existing.resetAt },
  };
}

export function buildPartnerRateLimitKeys(input: {
  ip: string | null | undefined;
  companyCode?: string | null;
}): { ipKey: string; companyCodeKey: string | null } {
  const ip = input.ip?.trim() || "unknown";
  const code = input.companyCode?.trim().toUpperCase() ?? "";
  return {
    ipKey: `partner:ip:${ip}`,
    companyCodeKey: code ? `partner:code:${code}` : null,
  };
}

export const PARTNER_RATE_LIMIT_WINDOW_MS = 60_000;
export const PARTNER_RATE_LIMIT_MAX_PER_IP = 30;
export const PARTNER_RATE_LIMIT_MAX_PER_COMPANY_CODE = 10;
