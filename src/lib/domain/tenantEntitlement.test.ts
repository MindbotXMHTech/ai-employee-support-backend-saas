import { describe, expect, it } from "vitest";
import { fakeTenant } from "@/test/fixtures";
import {
  evaluateTenantEntitlement,
  FREE_PLAN_CHAT_BLOCKED_MESSAGE,
  NO_QUOTA_CHAT_BLOCKED_MESSAGE,
  TRIAL_EXPIRED_CHAT_BLOCKED_MESSAGE,
} from "./tenantEntitlement";

describe("evaluateTenantEntitlement", () => {
  it("blocks suspended tenants before quota checks", () => {
    expect(
      evaluateTenantEntitlement({
        plan: "pro",
        status: "suspended",
        monthly_message_limit: 30_000,
        trial_ends_at: null,
      }),
    ).toEqual({
      ok: false,
      code: "TENANT_SUSPENDED",
      message: "Tenant is suspended.",
    });
  });

  it("blocks legacy free plan before quota check", () => {
    expect(
      evaluateTenantEntitlement({
        plan: "free",
        status: "expired",
        monthly_message_limit: 500,
        trial_ends_at: null,
      }),
    ).toEqual({
      ok: false,
      code: "TRIAL_EXPIRED",
      message: FREE_PLAN_CHAT_BLOCKED_MESSAGE,
    });
  });

  it("blocks expired status before quota check", () => {
    expect(
      evaluateTenantEntitlement({
        plan: "pro",
        status: "expired",
        monthly_message_limit: 30_000,
        trial_ends_at: null,
      }),
    ).toEqual({
      ok: false,
      code: "TRIAL_EXPIRED",
      message: FREE_PLAN_CHAT_BLOCKED_MESSAGE,
    });
  });

  it("blocks zero monthly message limit when status is still active (partner quota exhausted)", () => {
    expect(
      evaluateTenantEntitlement({
        plan: "trial",
        status: "active",
        monthly_message_limit: 0,
        trial_ends_at: null,
      }),
    ).toEqual({
      ok: false,
      code: "TENANT_SUSPENDED",
      message: NO_QUOTA_CHAT_BLOCKED_MESSAGE,
    });
  });

  it("blocks suspended status before quota message", () => {
    expect(
      evaluateTenantEntitlement({
        plan: "trial",
        status: "suspended",
        monthly_message_limit: 30_000,
        trial_ends_at: null,
      }),
    ).toEqual({
      ok: false,
      code: "TENANT_SUSPENDED",
      message: "Tenant is suspended.",
    });
  });

  it("blocks legacy expired trial by date", () => {
    expect(
      evaluateTenantEntitlement(
        {
          plan: "trial",
          status: "active",
          monthly_message_limit: 500,
          trial_ends_at: "2020-01-01T00:00:00.000Z",
        },
        new Date("2026-01-01T00:00:00.000Z"),
      ),
    ).toEqual({
      ok: false,
      code: "TRIAL_EXPIRED",
      message: TRIAL_EXPIRED_CHAT_BLOCKED_MESSAGE,
    });
  });

  it("allows partner-style tenant with null trial end and positive quota", () => {
    const result = evaluateTenantEntitlement({
      plan: "trial",
      status: "active",
      monthly_message_limit: 500,
      trial_ends_at: null,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tenant.monthly_message_limit).toBe(500);
    }
  });

  it("allows active pro tenant with quota", () => {
    const result = evaluateTenantEntitlement({
      ...fakeTenant,
      plan: "pro",
      status: "active",
      monthly_message_limit: 30_000,
      trial_ends_at: null,
    });
    expect(result.ok).toBe(true);
  });
});
