import type { Tenant } from "@/lib/types";

export type TenantAvailabilityResult =
  | { ok: true; tenant: Tenant }
  | {
      ok: false;
      code: "TENANT_SUSPENDED" | "TRIAL_EXPIRED";
      message: string;
    };

export type TenantEntitlementInput = Pick<
  Tenant,
  "plan" | "status" | "monthly_message_limit" | "trial_ends_at"
>;

export const NO_QUOTA_CHAT_BLOCKED_MESSAGE = "Tenant has no message quota.";
export const FREE_PLAN_CHAT_BLOCKED_MESSAGE = "Free plan is not available for chat.";
export const TRIAL_EXPIRED_CHAT_BLOCKED_MESSAGE = "Trial period has expired.";

/** Pure entitlement check — legacy plan/status before quota so free/expired never bypass via stale limit. */
export function evaluateTenantEntitlement(
  tenant: TenantEntitlementInput,
  now: Date = new Date(),
): TenantAvailabilityResult {
  if (tenant.status === "suspended") {
    return {
      ok: false as const,
      code: "TENANT_SUSPENDED" as const,
      message: "Tenant is suspended.",
    };
  }

  if (tenant.status === "expired" || tenant.plan === "free") {
    return {
      ok: false as const,
      code: "TRIAL_EXPIRED" as const,
      message: FREE_PLAN_CHAT_BLOCKED_MESSAGE,
    };
  }

  if ((tenant.monthly_message_limit ?? 0) <= 0) {
    return {
      ok: false as const,
      code: "TENANT_SUSPENDED" as const,
      message: NO_QUOTA_CHAT_BLOCKED_MESSAGE,
    };
  }

  if (
    tenant.plan === "trial" &&
    tenant.trial_ends_at &&
    new Date(tenant.trial_ends_at) <= now
  ) {
    return {
      ok: false as const,
      code: "TRIAL_EXPIRED" as const,
      message: TRIAL_EXPIRED_CHAT_BLOCKED_MESSAGE,
    };
  }

  return { ok: true as const, tenant: tenant as Tenant };
}
