import crypto from "node:crypto";

/**
 * When `configuredSecret` is unset/empty, returns true (legacy first-run behavior).
 * When set, header `x-platform-setup-secret` or body `setup_secret` must match (UTF-8, timing-safe).
 */
export function validateOptionalPlatformSetupSecret(input: {
  headerValue: string | null;
  bodyValue: string | undefined;
  configuredSecret: string | undefined;
}): boolean {
  const expected = input.configuredSecret?.trim();
  if (!expected) return true;

  const providedRaw =
    input.headerValue?.trim() ||
    input.bodyValue?.trim() ||
    "";
  const actual = Buffer.from(providedRaw, "utf8");
  const want = Buffer.from(expected, "utf8");
  if (actual.length !== want.length) return false;
  return crypto.timingSafeEqual(actual, want);
}
