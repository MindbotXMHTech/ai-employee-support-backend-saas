import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeTenant } from "@/test/fixtures";

describe("enforceTenantAvailability", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("delegates to evaluateTenantEntitlement for zero quota", async () => {
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
});
