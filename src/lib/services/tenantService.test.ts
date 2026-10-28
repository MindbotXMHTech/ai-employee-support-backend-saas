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

describe("createPartnerTenantOnboarding", () => {
  afterEach(() => {
    vi.doUnmock("@/lib/supabase/server");
    vi.doUnmock("@/lib/services/companyCodeService");
    vi.doUnmock("@/lib/services/platformAiSettingsService");
    vi.doUnmock("@/lib/repositories/aiSessionQuotaRepository");
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("writes a zero session row after the tenant insert and before the profile insert", async () => {
    const calls: string[] = [];
    const upsertQuota = vi.fn(async (tenantId: string) => {
      calls.push("upsertQuota");
      return {
        tenantId,
        base_limit: 0,
        base_used: 0,
        topup_balance: 0,
        updated_at: "2026-10-28T00:00:00.000Z",
      };
    });
    let tenantInsert: unknown;

    const chain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: async () => ({ data: null, error: null }),
      single: async () => ({ data: { id: "tenant-1" }, error: null }),
    };
    const tableCalls: string[] = [];
    const client = {
      from: (table: string) => {
        tableCalls.push(table);
        if (table === "tenants") {
          return {
            ...chain,
            insert: (payload: unknown) => {
              calls.push("tenants.insert");
              tenantInsert = payload;
              return chain;
            },
          };
        }
        return {
          ...chain,
          insert: () => {
            calls.push(`${table}.insert`);
            return chain;
          },
        };
      },
    };

    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceClient: () => client,
    }));
    vi.doMock("@/lib/services/companyCodeService", () => ({
      isCompanyCodeTaken: async () => false,
      insertCompanyCodeForTenant: async () => ({ code: "ACME" }),
      ensureCompanyCodeForTenant: async () => ({ code: "ACME" }),
      CompanyCodeTakenError: class CompanyCodeTakenError extends Error {},
    }));
    vi.doMock("@/lib/services/platformAiSettingsService", () => ({
      getPlatformAiSettings: async () => ({
        name: "Central Employee Support Bot",
        default_language: "th",
        max_sentences: 5,
        tone: "warm",
        general_model: "gpt",
        rag_model: "gpt",
        safety_model: "gpt",
        embedding_model: "embed",
        rag_enabled: false,
        mental_health_enabled: true,
        safety_enabled: true,
        handoff_enabled: true,
        classification_enabled: true,
        system_instruction: null,
      }),
    }));
    vi.doMock("@/lib/repositories/aiSessionQuotaRepository", () => ({
      upsertQuota,
    }));

    const { createPartnerTenantOnboarding } = await import("./tenantService");
    await createPartnerTenantOnboarding({
      name: "Acme",
      quota: 500,
      admin_email: "hr@acme.test",
      admin_display_name: "HR",
      company_code: "ACME",
    });

    const tenantAt = calls.indexOf("tenants.insert");
    const quotaAt = calls.indexOf("upsertQuota");
    const profileAt = calls.indexOf("tenant_profiles.insert");
    expect(tenantAt).toBeGreaterThanOrEqual(0);
    expect(quotaAt).toBe(tenantAt + 1);
    expect(profileAt).toBe(quotaAt + 1);
    expect(upsertQuota).toHaveBeenCalledTimes(1);
    expect(upsertQuota).toHaveBeenCalledWith("tenant-1");
    expect(tenantInsert).toEqual(expect.objectContaining({ monthly_message_limit: 500 }));
    expect(tableCalls.filter((table) => table === "tenant_ai_session_quota")).toEqual([]);
  });
});
