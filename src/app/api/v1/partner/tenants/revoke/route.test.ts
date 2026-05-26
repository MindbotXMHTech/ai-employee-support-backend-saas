import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { jsonRequest } from "@/test/mockNextRequest";

const revokePartnerProvisionedTenantByCompanyCode = vi.hoisted(() => vi.fn());

describe("POST /api/v1/partner/tenants/revoke", () => {
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
    revokePartnerProvisionedTenantByCompanyCode.mockReset();
  });

  it("returns 401 when secret header is missing", async () => {
    vi.doMock("@/lib/services/tenantService", () => ({ revokePartnerProvisionedTenantByCompanyCode }));

    const { POST } = await import("./route");
    const res = await POST(
      jsonRequest("http://localhost/api/v1/partner/tenants/revoke", { company_code: "ACME01" }),
    );
    expect(res.status).toBe(401);
    expect(revokePartnerProvisionedTenantByCompanyCode).not.toHaveBeenCalled();
  });

  it("returns 403 when tenant was not partner-provisioned", async () => {
    vi.doMock("@/lib/services/tenantService", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/lib/services/tenantService")>();
      return {
        ...actual,
        revokePartnerProvisionedTenantByCompanyCode,
      };
    });
    revokePartnerProvisionedTenantByCompanyCode.mockRejectedValue(
      new (await import("@/lib/services/tenantService")).PartnerTenantRevokeForbiddenError(),
    );

    const { POST } = await import("./route");
    const res = await POST(
      jsonRequest(
        "http://localhost/api/v1/partner/tenants/revoke",
        { company_code: "ACME01" },
        { [headerName]: secret },
      ),
    );
    expect(res.status).toBe(403);
  });

  it("returns 200 when revoke succeeds", async () => {
    vi.doMock("@/lib/services/tenantService", () => ({ revokePartnerProvisionedTenantByCompanyCode }));
    revokePartnerProvisionedTenantByCompanyCode.mockResolvedValue({
      ok: true,
      code: "REVOKED",
      idempotent: false,
      tenant_id: "t1",
    });

    const { POST } = await import("./route");
    const res = await POST(
      jsonRequest(
        "http://localhost/api/v1/partner/tenants/revoke",
        { company_code: "ACME01", event_id: "prov-1" },
        { [headerName]: secret },
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result).toBe("REVOKED");
    expect(revokePartnerProvisionedTenantByCompanyCode).toHaveBeenCalledWith(
      expect.objectContaining({ company_code: "ACME01", event_id: "prov-1" }),
    );
  });
});
