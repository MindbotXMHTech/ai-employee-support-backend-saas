import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeTenant } from "@/test/fixtures";

describe("centralBotService", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("registers an employee link from an active company code", async () => {
    let upsertPayload: unknown;
    let upsertOptions: unknown;
    const companyCodeRow = {
      id: "company-code-id",
      tenant_id: fakeTenant.id,
      tenants: fakeTenant,
    };
    const linkRow = { id: "link-id", tenant_id: fakeTenant.id, external_user_id: "line-user-001", channel: "line" };

    const client = {
      from: (table: string) => {
        if (table === "tenant_company_codes") {
          const chain = {
            select: () => chain,
            eq: () => chain,
            maybeSingle: async () => ({ data: companyCodeRow, error: null }),
          };
          return chain;
        }

        const chain = {
          select: () => chain,
          eq: () => chain,
          maybeSingle: async () => ({ data: null, error: null }),
          upsert: (payload: unknown, options: unknown) => {
            upsertPayload = payload;
            upsertOptions = options;
            return chain;
          },
          single: async () => ({ data: linkRow, error: null }),
        };
        return chain;
      },
    };

    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceClient: () => client,
    }));

    const { registerEmployeeTenantLink } = await import("./centralBotService");
    const result = await registerEmployeeTenantLink({
      externalUserId: "line-user-001",
      channel: "line",
      companyCode: " abc503 ",
      displayName: "Postman User",
      metadata: { source: "test" },
    });

    expect(result?.tenant).toEqual(fakeTenant);
    expect(result?.link).toEqual(linkRow);
    expect(upsertPayload).toEqual({
      tenant_id: fakeTenant.id,
      external_user_id: "line-user-001",
      channel: "line",
      company_code_id: "company-code-id",
      metadata: {
        source: "test",
        display_name: "Postman User",
        linked_by: "company_code",
      },
    });
    expect(upsertOptions).toEqual({ onConflict: "external_user_id,channel" });
  });

  it("does not create employee links for invalid company codes", async () => {
    const upsert = vi.fn();
    const client = {
      from: (table: string) => {
        if (table === "tenant_company_codes") {
          const chain = {
            select: () => chain,
            eq: () => chain,
            maybeSingle: async () => ({ data: null, error: null }),
          };
          return chain;
        }

        return { upsert };
      },
    };

    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceClient: () => client,
    }));

    const { registerEmployeeTenantLink } = await import("./centralBotService");
    const result = await registerEmployeeTenantLink({
      externalUserId: "line-user-001",
      channel: "line",
      companyCode: "BADCODE",
    });

    expect(result).toBeNull();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("allows idempotent re-register for the same tenant", async () => {
    const upsert = vi.fn().mockReturnValue({
      select: () => ({
        single: async () => ({
          data: { id: "link-id", tenant_id: fakeTenant.id },
          error: null,
        }),
      }),
    });
    const companyCodeRow = {
      id: "company-code-id",
      tenant_id: fakeTenant.id,
      tenants: fakeTenant,
    };

    const client = {
      from: (table: string) => {
        if (table === "tenant_company_codes") {
          const chain = {
            select: () => chain,
            eq: () => chain,
            maybeSingle: async () => ({ data: companyCodeRow, error: null }),
          };
          return chain;
        }

        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { tenant_id: fakeTenant.id }, error: null }),
              }),
            }),
          }),
          upsert,
        };
      },
    };

    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceClient: () => client,
    }));

    const { registerEmployeeTenantLink } = await import("./centralBotService");
    const result = await registerEmployeeTenantLink({
      externalUserId: "line-user-001",
      channel: "line",
      companyCode: "ABC503",
    });

    expect(result?.tenant).toEqual(fakeTenant);
    expect(upsert).toHaveBeenCalledOnce();
  });

  it("rejects register when employee is already linked to a different tenant", async () => {
    const upsert = vi.fn();
    const companyCodeRow = {
      id: "company-code-id",
      tenant_id: fakeTenant.id,
      tenants: fakeTenant,
    };

    const client = {
      from: (table: string) => {
        if (table === "tenant_company_codes") {
          const chain = {
            select: () => chain,
            eq: () => chain,
            maybeSingle: async () => ({ data: companyCodeRow, error: null }),
          };
          return chain;
        }

        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { tenant_id: "other-tenant-id" }, error: null }),
              }),
            }),
          }),
          upsert,
        };
      },
    };

    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceClient: () => client,
    }));

    const { registerEmployeeTenantLink, TenantConflictError } = await import("./centralBotService");

    await expect(
      registerEmployeeTenantLink({
        externalUserId: "line-user-001",
        channel: "line",
        companyCode: "ABC503",
      }),
    ).rejects.toBeInstanceOf(TenantConflictError);

    expect(upsert).not.toHaveBeenCalled();
  });

  it("resolveTenantForCentralBot returns tenant_conflict instead of throwing", async () => {
    let employeeLinkQueries = 0;
    const companyCodeRow = {
      id: "company-code-id",
      tenant_id: fakeTenant.id,
      tenants: fakeTenant,
    };

    const client = {
      from: (table: string) => {
        if (table === "tenant_company_codes") {
          const chain = {
            select: () => chain,
            eq: () => chain,
            maybeSingle: async () => ({ data: companyCodeRow, error: null }),
          };
          return chain;
        }

        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => {
                  employeeLinkQueries += 1;
                  if (employeeLinkQueries === 1) {
                    return { data: null, error: null };
                  }
                  return { data: { tenant_id: "other-tenant-id" }, error: null };
                },
              }),
            }),
          }),
          upsert: vi.fn(),
        };
      },
    };

    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceClient: () => client,
    }));

    const { resolveTenantForCentralBot } = await import("./centralBotService");
    const result = await resolveTenantForCentralBot({
      externalUserId: "line-user-001",
      channel: "line",
      companyCode: "ABC503",
    });

    expect(result).toEqual({ ok: false, reason: "tenant_conflict" });
  });

  it("resolveTenantForCentralBot returns tenant_conflict when existing link and company code differ", async () => {
    const linkedTenantId = "linked-tenant-id";
    const client = {
      from: (table: string) => {
        if (table === "tenant_company_codes") {
          const chain = {
            select: () => chain,
            eq: () => chain,
            maybeSingle: async () => ({ data: { tenant_id: fakeTenant.id }, error: null }),
          };
          return chain;
        }

        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { tenant_id: linkedTenantId, tenants: fakeTenant },
                  error: null,
                }),
              }),
            }),
          }),
        };
      },
    };

    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceClient: () => client,
    }));

    const { resolveTenantForCentralBot } = await import("./centralBotService");
    const result = await resolveTenantForCentralBot({
      externalUserId: "line-user-001",
      channel: "line",
      companyCode: "OTHERCO",
    });

    expect(result).toEqual({ ok: false, reason: "tenant_conflict" });
  });

  it("resolveTenantForCentralBot keeps existing tenant when company code matches linked tenant", async () => {
    const client = {
      from: (table: string) => {
        if (table === "tenant_company_codes") {
          const chain = {
            select: () => chain,
            eq: () => chain,
            maybeSingle: async () => ({ data: { tenant_id: fakeTenant.id }, error: null }),
          };
          return chain;
        }

        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { tenant_id: fakeTenant.id, tenants: fakeTenant },
                  error: null,
                }),
              }),
            }),
          }),
        };
      },
    };

    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceClient: () => client,
    }));

    const { resolveTenantForCentralBot } = await import("./centralBotService");
    const result = await resolveTenantForCentralBot({
      externalUserId: "line-user-001",
      channel: "line",
      companyCode: "ABC503",
    });

    expect(result).toEqual({ ok: true, tenant: fakeTenant, linked: true });
  });
});
