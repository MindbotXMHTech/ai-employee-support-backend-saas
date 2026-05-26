/** Pure partner-quota rules — no I/O; used by tenantService partner APIs. */

export const PARTNER_TENANT_RESOURCE_DEFAULTS = {
  storage_limit_mb: 50,
  max_files: 10,
  max_bots: 1,
} as const;

/** Placeholder plan column for partner tenants; entitlement uses quota + status. */
export const PARTNER_TENANT_PLACEHOLDER_PLAN = "trial" as const;

export function deriveTenantStatusFromQuota(quota: number): "active" | "suspended" {
  return quota > 0 ? "active" : "suspended";
}

export function normalizePartnerCompanyCode(companyCode: string): string {
  return companyCode.trim().toUpperCase();
}

export function buildPartnerQuotaTenantUpdate(quota: number): {
  monthly_message_limit: number;
  status: "active" | "suspended";
} {
  return {
    monthly_message_limit: quota,
    status: deriveTenantStatusFromQuota(quota),
  };
}

export function buildPartnerTenantInsertRow(input: {
  name: string;
  slug: string;
  quota: number;
}): {
  name: string;
  slug: string;
  plan: typeof PARTNER_TENANT_PLACEHOLDER_PLAN;
  status: "active" | "suspended";
  trial_started_at: null;
  trial_ends_at: null;
  monthly_message_limit: number;
  storage_limit_mb: number;
  max_files: number;
  max_bots: number;
} {
  return {
    name: input.name,
    slug: input.slug,
    plan: PARTNER_TENANT_PLACEHOLDER_PLAN,
    status: deriveTenantStatusFromQuota(input.quota),
    trial_started_at: null,
    trial_ends_at: null,
    monthly_message_limit: input.quota,
    ...PARTNER_TENANT_RESOURCE_DEFAULTS,
  };
}

export function buildPartnerPlanSyncAuditMetadata(input: {
  eventId: string;
  companyCode: string;
  quota: number;
  derivedStatus: "active" | "suspended";
  previousMonthlyMessageLimit: number | null;
  previousStatus: string | null;
  occurredAt?: string | null;
  updatedBy?: string | null;
}): Record<string, unknown> {
  return {
    event_id: input.eventId,
    company_code: normalizePartnerCompanyCode(input.companyCode),
    previous_monthly_message_limit: input.previousMonthlyMessageLimit,
    previous_status: input.previousStatus,
    quota: input.quota,
    status: input.derivedStatus,
    occurred_at: input.occurredAt ?? null,
    updated_by: input.updatedBy ?? null,
    source: "mindbloom_partner_sync",
  };
}

export function buildPartnerOnboardAuditMetadata(input: {
  adminEmail: string;
  adminDisplayName: string;
  slug: string;
  companyCode: string;
  quota: number;
  provisionedAt: string;
}): Record<string, unknown> {
  return {
    admin_email: input.adminEmail.trim().toLowerCase(),
    admin_display_name: input.adminDisplayName,
    slug: input.slug,
    partner_company_code: normalizePartnerCompanyCode(input.companyCode),
    quota: input.quota,
    source: "mindbloom_partner",
    provisioned_at: input.provisionedAt,
  };
}

export function buildPartnerRevokeAuditMetadata(input: {
  companyCode: string;
  eventId?: string | null;
  reason?: string | null;
}): Record<string, unknown> {
  return {
    company_code: normalizePartnerCompanyCode(input.companyCode),
    event_id: input.eventId ?? null,
    reason: input.reason ?? "mindbloom_local_provision_failed",
    source: "mindbloom_partner_compensate",
  };
}

export function normalizePartnerAdminEmail(email: string): string {
  return email.trim().toLowerCase();
}
