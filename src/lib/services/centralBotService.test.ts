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
          upsert: (payload: unknown, options: unknown) => {
            upsertPayload = payload;
            upsertOptions = options;
            return chain;
          },
          select: () => chain,
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
});
