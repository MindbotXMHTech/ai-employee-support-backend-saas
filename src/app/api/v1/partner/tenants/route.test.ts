import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { jsonRequest } from "@/test/mockNextRequest";

const createPartnerTenantOnboarding = vi.hoisted(() => vi.fn());

describe("POST /api/v1/partner/tenants", () => {
  const secret = "partner-provision-secret-value-32b!!";
  const headerName = "x-tenant-provision-secret";

  beforeEach(() => {
    vi.stubEnv("TENANT_PROVISION_SECRET", secret);
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.doUnmock("@/lib/services/tenantService");
    createPartnerTenantOnboarding.mockReset();
  });

  it("returns 503 when TENANT_PROVISION_SECRET is not configured", async () => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.doMock("@/lib/services/tenantService", () => ({ createPartnerTenantOnboarding }));

    const { POST } = await import("./route");
    const res = await POST(
      jsonRequest("http://localhost/api/v1/partner/tenants", {
        company_code: "ACME01",
        name: "Acme",
        quota: 500,
        admin_email: "a@ex.com",
        admin_display_name: "Admin",
      }),
    );
    expect(res.status).toBe(503);
    expect(createPartnerTenantOnboarding).not.toHaveBeenCalled();
  });

  it("returns 401 when secret header is missing or wrong", async () => {
    vi.doMock("@/lib/services/tenantService", () => ({ createPartnerTenantOnboarding }));

    const { POST } = await import("./route");
    const bad = await POST(
      jsonRequest("http://localhost/api/v1/partner/tenants", {
        company_code: "ACME01",
        name: "Acme",
        quota: 500,
        admin_email: "a@ex.com",
        admin_display_name: "Admin",
      }),
    );
    expect(bad.status).toBe(401);

    const bad2 = await POST(
      jsonRequest(
        "http://localhost/api/v1/partner/tenants",
        {
          company_code: "ACME01",
          name: "Acme",
          quota: 500,
          admin_email: "a@ex.com",
          admin_display_name: "Admin",
        },
        { [headerName]: "wrong" },
      ),
    );
    expect(bad2.status).toBe(401);
    expect(createPartnerTenantOnboarding).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid payload", async () => {
    vi.doMock("@/lib/services/tenantService", () => ({ createPartnerTenantOnboarding }));

    const { POST } = await import("./route");
    const res = await POST(
      jsonRequest(
        "http://localhost/api/v1/partner/tenants",
        { name: "x", quota: 500, admin_email: "a@b.com", admin_display_name: "A" },
        { [headerName]: secret },
      ),
    );
    expect(res.status).toBe(400);
    expect(createPartnerTenantOnboarding).not.toHaveBeenCalled();
  });

  it("returns 409 when company code is taken", async () => {
    vi.doMock("@/lib/services/tenantService", () => ({ createPartnerTenantOnboarding }));
    const { CompanyCodeTakenError } = await import("@/lib/services/companyCodeService");
    createPartnerTenantOnboarding.mockRejectedValue(new CompanyCodeTakenError());

    const { POST } = await import("./route");
    const res = await POST(
      jsonRequest(
        "http://localhost/api/v1/partner/tenants",
        {
          company_code: "TAKEN1",
          name: "Co",
          quota: 500,
          admin_email: "a@ex.com",
          admin_display_name: "Admin",
        },
        { [headerName]: secret },
      ),
    );
    expect(res.status).toBe(409);
  });

  it("returns 200 with runtime tenant payload when provision succeeds", async () => {
    vi.doMock("@/lib/services/tenantService", () => ({ createPartnerTenantOnboarding }));
    createPartnerTenantOnboarding.mockResolvedValue({
      tenant: { id: "t1", name: "Co", monthly_message_limit: 500, status: "active" },
      companyCode: { code: "ACME99" },
      admin_email: "a@ex.com",
      admin_display_name: "Admin",
    });

    const { POST } = await import("./route");
    const res = await POST(
      jsonRequest(
        "http://localhost/api/v1/partner/tenants",
        {
          company_code: "ACME99",
          name: "Co",
          quota: 500,
          admin_email: "a@ex.com",
          admin_display_name: "Admin",
        },
        { [headerName]: secret },
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.provisioned_company_code).toBe("ACME99");
    expect(body.quota).toBe(500);
    expect(body.temporaryPassword).toBeUndefined();
    expect(createPartnerTenantOnboarding).toHaveBeenCalledWith(
      expect.objectContaining({
        company_code: "ACME99",
        quota: 500,
        created_by: null,
      }),
    );
  });
});
