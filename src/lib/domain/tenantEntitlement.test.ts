import { describe, expect, it } from "vitest";
import { fakeTenant } from "@/test/fixtures";
import {
  evaluateTenantEntitlement,
  NO_QUOTA_ALLOCATION_MESSAGE,
  SUBSCRIPTION_EXPIRED_MESSAGE,
  SUBSCRIPTION_SUSPENDED_MESSAGE,
} from "./tenantEntitlement";

const PLAN_NAME_PATTERN = /free|trial|pro|plan/i;

describe("evaluateTenantEntitlement", () => {
  it("blocks suspended tenants before expired and quota checks", () => {
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
      message: SUBSCRIPTION_SUSPENDED_MESSAGE,
    });
    expect(SUBSCRIPTION_SUSPENDED_MESSAGE).not.toMatch(PLAN_NAME_PATTERN);
  });

  it("blocks legacy free plan before quota allocation check without exposing plan name", () => {
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
      message: SUBSCRIPTION_EXPIRED_MESSAGE,
    });
    expect(SUBSCRIPTION_EXPIRED_MESSAGE).not.toMatch(PLAN_NAME_PATTERN);
  });

  it("blocks expired status before quota allocation check", () => {
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
      message: SUBSCRIPTION_EXPIRED_MESSAGE,
    });
  });

  it("blocks zero monthly_message_limit from Mindbloom sync quota=0 when status is active", () => {
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
      message: NO_QUOTA_ALLOCATION_MESSAGE,
    });
  });

  it("blocks partner free tier via suspended check before zero limit", () => {
    expect(
      evaluateTenantEntitlement({
        plan: "trial",
        status: "suspended",
        monthly_message_limit: 0,
        trial_ends_at: null,
      }),
    ).toEqual({
      ok: false,
      code: "TENANT_SUSPENDED",
      message: SUBSCRIPTION_SUSPENDED_MESSAGE,
    });
  });

  it("blocks legacy expired trial by date without exposing plan name", () => {
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
      message: SUBSCRIPTION_EXPIRED_MESSAGE,
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
