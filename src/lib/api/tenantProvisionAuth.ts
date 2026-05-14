import crypto from "node:crypto";
import { env } from "@/lib/env";

/** Header partner systems send: mirrors central bot pattern (`x-central-bot-secret`). */
export const TENANT_PROVISION_SECRET_HEADER = "x-tenant-provision-secret";

export function validateTenantProvisionSecret(secret: string | null) {
  if (!env.TENANT_PROVISION_SECRET || !secret) return false;
  const actual = Buffer.from(secret, "utf8");
  const expected = Buffer.from(env.TENANT_PROVISION_SECRET, "utf8");
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}
