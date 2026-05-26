import { describe, expect, it } from "vitest";
import {
  partnerProvisionTenantSchema,
  partnerRevokeTenantSchema,
  partnerTenantPlanSyncSchema,
} from "./partnerProvision";

describe("partnerProvisionTenantSchema", () => {
  const valid = {
    company_code: "acme01",
    name: "Acme",
    quota: 500,
    admin_email: "admin@acme.com",
    admin_display_name: "Admin",
  };

  it("accepts valid quota-only provision body and uppercases company_code", () => {
    const parsed = partnerProvisionTenantSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.company_code).toBe("ACME01");
      expect(parsed.data.quota).toBe(500);
    }
  });

  it("coerces string quota to integer", () => {
    const parsed = partnerProvisionTenantSchema.safeParse({ ...valid, quota: "30000" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.quota).toBe(30_000);
  });

  it("rejects missing company_code", () => {
    const { company_code: _, ...rest } = valid;
    expect(partnerProvisionTenantSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects short company_code", () => {
    expect(partnerProvisionTenantSchema.safeParse({ ...valid, company_code: "ab" }).success).toBe(false);
  });

  it("rejects non-alphanumeric company_code", () => {
    expect(partnerProvisionTenantSchema.safeParse({ ...valid, company_code: "acme-01" }).success).toBe(
      false,
    );
  });

  it("rejects quota below zero", () => {
    expect(partnerProvisionTenantSchema.safeParse({ ...valid, quota: -1 }).success).toBe(false);
  });

  it("rejects quota above max", () => {
    expect(partnerProvisionTenantSchema.safeParse({ ...valid, quota: 1_000_001 }).success).toBe(false);
  });

  it("rejects invalid admin_email", () => {
    expect(partnerProvisionTenantSchema.safeParse({ ...valid, admin_email: "not-email" }).success).toBe(
      false,
    );
  });

  it("rejects body with plan field (not in schema — stripped by safeParse failure if extra strict)", () => {
    const withPlan = { ...valid, plan: "pro" };
    const parsed = partnerProvisionTenantSchema.safeParse(withPlan);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty("plan");
    }
  });
});

describe("partnerTenantPlanSyncSchema", () => {
  const valid = {
    company_code: "xaz342wg",
    quota: 0,
    event_id: "company-plan-sync:XAZ342WG:2026-05-20T08:00:00.000Z",
  };

  it("accepts quota-only sync payload", () => {
    const parsed = partnerTenantPlanSyncSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.company_code).toBe("XAZ342WG");
      expect(parsed.data.quota).toBe(0);
    }
  });

  it("accepts optional occurred_at and updated_by", () => {
    const parsed = partnerTenantPlanSyncSchema.safeParse({
      ...valid,
      occurred_at: "2026-05-20T08:00:00.000Z",
      updated_by: "super-admin-1",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects missing event_id", () => {
    const { event_id: _, ...rest } = valid;
    expect(partnerTenantPlanSyncSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects invalid occurred_at datetime", () => {
    expect(
      partnerTenantPlanSyncSchema.safeParse({ ...valid, occurred_at: "not-a-date" }).success,
    ).toBe(false);
  });

  it("rejects sync body with plan field absent from contract", () => {
    const parsed = partnerTenantPlanSyncSchema.safeParse({ ...valid, plan: "pro", status: "active" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty("plan");
      expect(parsed.data).not.toHaveProperty("status");
    }
  });
});

describe("partnerRevokeTenantSchema", () => {
  it("accepts company_code only", () => {
    const parsed = partnerRevokeTenantSchema.safeParse({ company_code: "acme01" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.company_code).toBe("ACME01");
  });

  it("accepts optional event_id and reason", () => {
    const parsed = partnerRevokeTenantSchema.safeParse({
      company_code: "ACME01",
      event_id: "prov-1",
      reason: "local_failed",
    });
    expect(parsed.success).toBe(true);
  });
});
