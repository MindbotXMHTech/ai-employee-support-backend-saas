import { describe, expect, it } from "vitest";
import {
  buildPartnerOnboardAuditMetadata,
  buildPartnerPlanSyncAuditMetadata,
  buildPartnerQuotaTenantUpdate,
  buildPartnerRevokeAuditMetadata,
  buildPartnerTenantInsertRow,
  deriveTenantStatusFromQuota,
  normalizePartnerAdminEmail,
  normalizePartnerCompanyCode,
  PARTNER_TENANT_PLACEHOLDER_PLAN,
  PARTNER_TENANT_RESOURCE_DEFAULTS,
} from "./partnerTenantLogic";

describe("deriveTenantStatusFromQuota", () => {
  it("returns active for positive quota", () => {
    expect(deriveTenantStatusFromQuota(1)).toBe("active");
    expect(deriveTenantStatusFromQuota(500)).toBe("active");
    expect(deriveTenantStatusFromQuota(30_000)).toBe("active");
    expect(deriveTenantStatusFromQuota(1_000_000)).toBe("active");
  });

  it("returns suspended for zero quota", () => {
    expect(deriveTenantStatusFromQuota(0)).toBe("suspended");
  });

  it("returns suspended for negative quota (defensive)", () => {
    expect(deriveTenantStatusFromQuota(-1)).toBe("suspended");
  });
});

describe("normalizePartnerCompanyCode", () => {
  it("trims and uppercases", () => {
    expect(normalizePartnerCompanyCode("  acme01  ")).toBe("ACME01");
    expect(normalizePartnerCompanyCode("xaz342wg")).toBe("XAZ342WG");
  });
});

describe("normalizePartnerAdminEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizePartnerAdminEmail("  Admin@Example.COM ")).toBe("admin@example.com");
  });
});

describe("buildPartnerQuotaTenantUpdate", () => {
  it("maps quota to limit and derived status", () => {
    expect(buildPartnerQuotaTenantUpdate(30_000)).toEqual({
      monthly_message_limit: 30_000,
      status: "active",
    });
    expect(buildPartnerQuotaTenantUpdate(0)).toEqual({
      monthly_message_limit: 0,
      status: "suspended",
    });
  });
});

describe("buildPartnerTenantInsertRow", () => {
  it("uses placeholder plan, null trial dates, and resource defaults", () => {
    const row = buildPartnerTenantInsertRow({
      name: "Acme Co",
      slug: "acme-co",
      quota: 500,
    });

    expect(row).toEqual({
      name: "Acme Co",
      slug: "acme-co",
      plan: PARTNER_TENANT_PLACEHOLDER_PLAN,
      status: "active",
      trial_started_at: null,
      trial_ends_at: null,
      monthly_message_limit: 500,
      ...PARTNER_TENANT_RESOURCE_DEFAULTS,
    });
  });

  it("sets suspended status when quota is zero", () => {
    const row = buildPartnerTenantInsertRow({
      name: "Suspended Co",
      slug: "suspended-co",
      quota: 0,
    });
    expect(row.status).toBe("suspended");
    expect(row.monthly_message_limit).toBe(0);
  });
});

describe("buildPartnerPlanSyncAuditMetadata", () => {
  it("builds quota-only sync audit payload with normalized company code", () => {
    const metadata = buildPartnerPlanSyncAuditMetadata({
      eventId: "evt-1",
      companyCode: "  acme01 ",
      quota: 30_000,
      derivedStatus: "active",
      previousMonthlyMessageLimit: 500,
      previousStatus: "active",
      occurredAt: "2026-05-20T08:00:00.000Z",
      updatedBy: "super-admin-1",
    });

    expect(metadata).toEqual({
      event_id: "evt-1",
      company_code: "ACME01",
      previous_monthly_message_limit: 500,
      previous_status: "active",
      quota: 30_000,
      status: "active",
      occurred_at: "2026-05-20T08:00:00.000Z",
      updated_by: "super-admin-1",
      source: "mindbloom_partner_sync",
    });
    expect(JSON.stringify(metadata)).not.toContain('"plan"');
  });
});

describe("buildPartnerOnboardAuditMetadata", () => {
  it("records partner onboarding without plan field", () => {
    const metadata = buildPartnerOnboardAuditMetadata({
      adminEmail: " Admin@Co.com ",
      adminDisplayName: "Admin",
      slug: "acme-co",
      companyCode: "acme01",
      quota: 500,
      provisionedAt: "2026-05-20T08:00:00.000Z",
    });

    expect(metadata).toMatchObject({
      admin_email: "admin@co.com",
      admin_display_name: "Admin",
      slug: "acme-co",
      partner_company_code: "ACME01",
      quota: 500,
      source: "mindbloom_partner",
      provisioned_at: "2026-05-20T08:00:00.000Z",
    });
    expect(metadata).not.toHaveProperty("plan");
  });
});

describe("buildPartnerRevokeAuditMetadata", () => {
  it("uses default reason when omitted", () => {
    expect(
      buildPartnerRevokeAuditMetadata({ companyCode: "acme01" }),
    ).toEqual({
      company_code: "ACME01",
      event_id: null,
      reason: "mindbloom_local_provision_failed",
      source: "mindbloom_partner_compensate",
    });
  });

  it("preserves custom event_id and reason", () => {
    expect(
      buildPartnerRevokeAuditMetadata({
        companyCode: "ACME01",
        eventId: "prov-1",
        reason: "local_upsert_failed",
      }),
    ).toEqual({
      company_code: "ACME01",
      event_id: "prov-1",
      reason: "local_upsert_failed",
      source: "mindbloom_partner_compensate",
    });
  });
});
