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

/** Employee-facing: admin or partner sync suspension (no plan name exposed). */
export const SUBSCRIPTION_SUSPENDED_MESSAGE =
  "บริษัทถูกระงับการใช้งานชั่วคราว กรุณาติดต่อผู้ดูแลระบบของบริษัท";

/** Employee-facing: subscription expired or inactive (no plan name exposed). */
export const SUBSCRIPTION_EXPIRED_MESSAGE =
  "แพ็กเกจของบริษัทหมดอายุแล้ว กรุณาติดต่อผู้ดูแลระบบของบริษัท";

/**
 * Employee-facing: no message quota allocated (Mindbloom `calculateCompanyMessageQuota` → 0).
 * Distinct from usage-layer `checkQuota` when limit > 0 but messages are used up.
 */
export const NO_QUOTA_ALLOCATION_MESSAGE =
  "แพ็กเกจของบริษัทหมดอายุแล้ว กรุณาติดต่อผู้ดูแลระบบของบริษัท";

function subscriptionExpired(): TenantAvailabilityResult {
  return {
    ok: false as const,
    code: "TRIAL_EXPIRED" as const,
    message: SUBSCRIPTION_EXPIRED_MESSAGE,
  };
}

/** Pure entitlement check — separate status, expiry, and partner-sync quota allocation. */
export function evaluateTenantEntitlement(
  tenant: TenantEntitlementInput,
  now: Date = new Date(),
): TenantAvailabilityResult {
  if (tenant.status === "suspended") {
    return {
      ok: false as const,
      code: "TENANT_SUSPENDED" as const,
      message: SUBSCRIPTION_SUSPENDED_MESSAGE,
    };
  }

  if (tenant.status === "expired" || tenant.plan === "free") {
    return subscriptionExpired();
  }

  if ((tenant.monthly_message_limit ?? 0) <= 0) {
    return {
      ok: false as const,
      code: "TENANT_SUSPENDED" as const,
      message: NO_QUOTA_ALLOCATION_MESSAGE,
    };
  }

  if (
    tenant.plan === "trial" &&
    tenant.trial_ends_at &&
    new Date(tenant.trial_ends_at) <= now
  ) {
    return subscriptionExpired();
  }

  return { ok: true as const, tenant: tenant as Tenant };
}
