import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { jsonRequest } from "@/test/mockNextRequest";

const syncTenantPlanFromPartner = vi.hoisted(() => vi.fn());

describe("POST /api/v1/partner/tenants/sync-plan", () => {
  const secret = "partner-provision-secret-value-32b!!";
  const headerName = "x-tenant-provision-secret";
  const payload = {
    company_code: "xaz342wg",
    plan: "pro",
    status: "active",
    event_id: "liff-company-updated-001",
    occurred_at: "2026-05-20T08:00:00.000Z",
    updated_by: "line-liff-super-admin",
  };

  beforeEach(() => {
    vi.stubEnv("TENANT_PROVISION_SECRET", secret);
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.doUnmock("@/lib/services/tenantService");
    syncTenantPlanFromPartner.mockReset();
  });

  it("returns 503 when TENANT_PROVISION_SECRET is not configured", async () => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.doMock("@/lib/services/tenantService", () => ({ syncTenantPlanFromPartner }));

    const { POST } = await import("./route");
    const res = await POST(jsonRequest("http://localhost/api/v1/partner/tenants/sync-plan", payload));

    expect(res.status).toBe(503);
    expect(syncTenantPlanFromPartner).not.toHaveBeenCalled();
  });

  it("returns 401 when secret header is missing or wrong", async () => {
    vi.doMock("@/lib/services/tenantService", () => ({ syncTenantPlanFromPartner }));

    const { POST } = await import("./route");
    const missing = await POST(jsonRequest("http://localhost/api/v1/partner/tenants/sync-plan", payload));
    expect(missing.status).toBe(401);

    const wrong = await POST(
      jsonRequest("http://localhost/api/v1/partner/tenants/sync-plan", payload, { [headerName]: "wrong" }),
    );
    expect(wrong.status).toBe(401);
    expect(syncTenantPlanFromPartner).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid payload", async () => {
    vi.doMock("@/lib/services/tenantService", () => ({ syncTenantPlanFromPartner }));

    const { POST } = await import("./route");
    const res = await POST(
      jsonRequest(
        "http://localhost/api/v1/partner/tenants/sync-plan",
        { company_code: "XAZ342WG", plan: "enterprise", status: "active", event_id: "evt-1" },
        { [headerName]: secret },
      ),
    );

    expect(res.status).toBe(400);
    expect(syncTenantPlanFromPartner).not.toHaveBeenCalled();
  });

  it("returns 404 when company code is missing or revoked", async () => {
    vi.doMock("@/lib/services/tenantService", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/lib/services/tenantService")>();
      return { ...actual, syncTenantPlanFromPartner };
    });
    const { TenantCompanyCodeNotFoundError } = await import("@/lib/services/tenantService");
    syncTenantPlanFromPartner.mockRejectedValue(new TenantCompanyCodeNotFoundError());

    const { POST } = await import("./route");
    const res = await POST(
      jsonRequest("http://localhost/api/v1/partner/tenants/sync-plan", payload, { [headerName]: secret }),
    );

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      error: { code: "COMPANY_CODE_NOT_FOUND", message: "Invalid or revoked company code." },
    });
  });

  it("syncs plan/status by normalized company code", async () => {
    vi.doMock("@/lib/services/tenantService", () => ({ syncTenantPlanFromPartner }));
    syncTenantPlanFromPartner.mockResolvedValue({
      tenant: { id: "tenant-id", plan: "pro", status: "active" },
      companyCode: { code: "XAZ342WG" },
      idempotent: false,
    });

    const { POST } = await import("./route");
    const res = await POST(
      jsonRequest("http://localhost/api/v1/partner/tenants/sync-plan", payload, { [headerName]: secret }),
    );

    expect(res.status).toBe(200);
    expect(syncTenantPlanFromPartner).toHaveBeenCalledWith({
      ...payload,
      company_code: "XAZ342WG",
    });
    await expect(res.json()).resolves.toEqual({
      success: true,
      idempotent: false,
      tenant: { id: "tenant-id", plan: "pro", status: "active" },
      company_code: "XAZ342WG",
    });
  });

  it("returns idempotent success for retried partner events", async () => {
    vi.doMock("@/lib/services/tenantService", () => ({ syncTenantPlanFromPartner }));
    syncTenantPlanFromPartner.mockResolvedValue({
      tenant: { id: "tenant-id", plan: "pro", status: "active" },
      companyCode: { code: "XAZ342WG" },
      idempotent: true,
    });

    const { POST } = await import("./route");
    const res = await POST(
      jsonRequest("http://localhost/api/v1/partner/tenants/sync-plan", payload, { [headerName]: secret }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ success: true, idempotent: true });
  });
});
