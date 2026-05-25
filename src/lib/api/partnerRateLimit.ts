/**
 * Simple in-memory sliding-window rate limiter for partner provisioning endpoints.
 * Suitable for single-instance / serverless warm instances; use Redis for multi-region if needed.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 60_000;
const MAX_PER_IP = 30;
const MAX_PER_COMPANY_CODE = 10;

function checkLimit(key: string, max: number): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true };
  }
  if (existing.count >= max) {
    return { ok: false, retryAfterSec: Math.ceil((existing.resetAt - now) / 1000) };
  }
  existing.count += 1;
  return { ok: true };
}

export function checkPartnerProvisionRateLimit(input: {
  ip: string | null;
  companyCode?: string | null;
}): { ok: true } | { ok: false; retryAfterSec: number } {
  const ip = input.ip?.trim() || "unknown";
  const ipResult = checkLimit(`partner:ip:${ip}`, MAX_PER_IP);
  if (!ipResult.ok) return ipResult;

  if (input.companyCode) {
    const code = input.companyCode.trim().toUpperCase();
    if (code) {
      const codeResult = checkLimit(`partner:code:${code}`, MAX_PER_COMPANY_CODE);
      if (!codeResult.ok) return codeResult;
    }
  }

  return { ok: true };
}

/** @internal test helper */
export function resetPartnerProvisionRateLimitsForTests() {
  buckets.clear();
}
