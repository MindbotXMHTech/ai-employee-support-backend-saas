import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeTenant } from "@/test/fixtures";

describe("deriveTenantStatusFromQuota", () => {
  it("returns active when quota is positive", async () => {
    const { deriveTenantStatusFromQuota } = await import("./tenantService");
    expect(deriveTenantStatusFromQuota(500)).toBe("active");
    expect(deriveTenantStatusFromQuota(1)).toBe("active");
  });

  it("returns suspended when quota is zero", async () => {
    const { deriveTenantStatusFromQuota } = await import("./tenantService");
    expect(deriveTenantStatusFromQuota(0)).toBe("suspended");
  });
});

describe("enforceTenantAvailability", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("blocks tenants with zero monthly message limit", async () => {
    const { enforceTenantAvailability } = await import("./tenantService");

    const result = await enforceTenantAvailability({
      ...fakeTenant,
      plan: "pro",
      status: "active",
      monthly_message_limit: 0,
    });

    expect(result).toEqual({
      ok: false,
      code: "TENANT_SUSPENDED",
      message: "Tenant has no message quota.",
    });
  });

  it("blocks suspended tenants before quota checks", async () => {
    const { enforceTenantAvailability } = await import("./tenantService");

    const result = await enforceTenantAvailability({
      ...fakeTenant,
      plan: "pro",
      status: "suspended",
      monthly_message_limit: 30_000,
    });

    expect(result).toEqual({
      ok: false,
      code: "TENANT_SUSPENDED",
      message: "Tenant is suspended.",
    });
  });

  it("allows tenants with positive quota", async () => {
    const { enforceTenantAvailability } = await import("./tenantService");

    const result = await enforceTenantAvailability({
      ...fakeTenant,
      plan: "trial",
      status: "active",
      monthly_message_limit: 500,
      trial_ends_at: null,
    });
    expect(result).toEqual({ ok: true, tenant: expect.objectContaining({ monthly_message_limit: 500 }) });
  });

  it("blocks legacy free plan tenants even when monthly limit was not zeroed", async () => {
    const { enforceTenantAvailability } = await import("./tenantService");

    const result = await enforceTenantAvailability({
      ...fakeTenant,
      plan: "free",
      status: "expired",
      monthly_message_limit: 500,
      trial_ends_at: null,
    });

    expect(result).toEqual({
      ok: false,
      code: "TRIAL_EXPIRED",
      message: "Free plan is not available for chat.",
    });
  });

  it("blocks legacy expired-status tenants even when monthly limit was not zeroed", async () => {
    const { evaluateTenantEntitlement } = await import("./tenantService");

    const result = evaluateTenantEntitlement({
      plan: "pro",
      status: "expired",
      monthly_message_limit: 30_000,
      trial_ends_at: null,
    });

    expect(result).toEqual({
      ok: false,
      code: "TRIAL_EXPIRED",
      message: "Free plan is not available for chat.",
    });
  });

  it("blocks legacy expired trials even when monthly limit was not zeroed", async () => {
    const { evaluateTenantEntitlement } = await import("./tenantService");

    const result = evaluateTenantEntitlement(
      {
        plan: "trial",
        status: "active",
        monthly_message_limit: 500,
        trial_ends_at: "2020-01-01T00:00:00.000Z",
      },
      new Date("2026-01-01T00:00:00.000Z"),
    );

    expect(result).toEqual({
      ok: false,
      code: "TRIAL_EXPIRED",
      message: "Trial period has expired.",
    });
  });

  it("allows partner-style tenants with null trial end and positive quota", async () => {
    const { evaluateTenantEntitlement } = await import("./tenantService");

    const result = evaluateTenantEntitlement({
      plan: "trial",
      status: "active",
      monthly_message_limit: 500,
      trial_ends_at: null,
    });

    expect(result).toEqual({
      ok: true,
      tenant: expect.objectContaining({ monthly_message_limit: 500 }),
    });
  });
});
