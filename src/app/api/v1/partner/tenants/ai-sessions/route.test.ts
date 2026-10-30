import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { jsonRequest } from "@/test/mockNextRequest";

const applyPartnerAiSessionOp = vi.hoisted(() => vi.fn());
const checkPartnerProvisionRateLimit = vi.hoisted(() => vi.fn());

describe("POST /api/v1/partner/tenants/ai-sessions", () => {
  const url = "http://localhost/api/v1/partner/tenants/ai-sessions";
  const secret = "partner-provision-secret-value-32b!!";
  const headerName = "x-tenant-provision-secret";
  const payload = {
    company_code: "xaz342wg",
    op: "add_topup",
    amount: 20,
    event_id: "topup-001",
    occurred_at: "2026-10-28T08:00:00.000Z",
    updated_by: "super-admin-1",
  };

  async function loadRoute() {
    vi.doMock("@/lib/services/partnerAiSessionService", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/lib/services/partnerAiSessionService")>();
      return { ...actual, applyPartnerAiSessionOp };
    });
    vi.doMock("@/lib/api/partnerRateLimit", () => ({ checkPartnerProvisionRateLimit }));
    return import("./route");
  }

  beforeEach(() => {
    vi.stubEnv("TENANT_PROVISION_SECRET", secret);
    vi.resetModules();
    checkPartnerProvisionRateLimit.mockReturnValue({ ok: true });
  });

  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.doUnmock("@/lib/services/partnerAiSessionService");
    vi.doUnmock("@/lib/api/partnerRateLimit");
    applyPartnerAiSessionOp.mockReset();
    checkPartnerProvisionRateLimit.mockReset();
  });

  it("returns 503 when TENANT_PROVISION_SECRET is not configured", async () => {
    vi.stubEnv("TENANT_PROVISION_SECRET", "");
    const { POST } = await loadRoute();

    const res = await POST(jsonRequest(url, payload, { [headerName]: secret }));

    expect(res.status).toBe(503);
    expect(applyPartnerAiSessionOp).not.toHaveBeenCalled();
  });

  it("returns 401 when the secret header is wrong", async () => {
    const { POST } = await loadRoute();

    const res = await POST(jsonRequest(url, payload, { [headerName]: "wrong" }));

    expect(res.status).toBe(401);
    expect(applyPartnerAiSessionOp).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid body", async () => {
    const { POST } = await loadRoute();

    const res = await POST(jsonRequest(url, { ...payload, amount: 0 }, { [headerName]: secret }));

    expect(res.status).toBe(400);
    expect(applyPartnerAiSessionOp).not.toHaveBeenCalled();
  });

  it("returns 429 with Retry-After when rate limited", async () => {
    checkPartnerProvisionRateLimit.mockReturnValue({ ok: false, retryAfterSec: 42 });
    const { POST } = await loadRoute();

    const res = await POST(jsonRequest(url, payload, { [headerName]: secret }));

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("42");
    await expect(res.json()).resolves.toEqual({
      error: { code: "RATE_LIMITED", message: "Too many AI session requests." },
    });
    expect(applyPartnerAiSessionOp).not.toHaveBeenCalled();
  });

  it("returns 404 when the company code is missing or revoked", async () => {
    const { POST } = await loadRoute();
    const { TenantCompanyCodeNotFoundError } = await import("@/lib/services/tenantService");
    applyPartnerAiSessionOp.mockRejectedValue(new TenantCompanyCodeNotFoundError());

    const res = await POST(jsonRequest(url, payload, { [headerName]: secret }));

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      error: { code: "COMPANY_CODE_NOT_FOUND", message: "Invalid or revoked company code." },
    });
  });

  it("returns 409 when the event_id was used for a different operation", async () => {
    const { POST } = await loadRoute();
    const { PartnerEventIdConflictError } = await import("@/lib/services/partnerAiSessionService");
    applyPartnerAiSessionOp.mockRejectedValue(new PartnerEventIdConflictError());

    const res = await POST(jsonRequest(url, payload, { [headerName]: secret }));

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({ error: { code: "EVENT_ID_CONFLICT" } });
  });

  it("returns 500 without leaking the error message", async () => {
    const { POST } = await loadRoute();
    applyPartnerAiSessionOp.mockRejectedValue(new Error("db password is hunter2"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await POST(jsonRequest(url, payload, { [headerName]: secret }));

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: { code: "INTERNAL_ERROR", message: "Failed to apply AI session change." },
    });
  });

  it("returns the counters and remaining from the service on first apply", async () => {
    const { POST } = await loadRoute();
    applyPartnerAiSessionOp.mockResolvedValue({
      idempotent: false,
      companyCode: "XAZ342WG",
      op: "add_topup",
      base_limit: 100,
      base_used: 40,
      topup_balance: 27,
      remaining: 87,
    });

    const res = await POST(jsonRequest(url, payload, { [headerName]: secret }));

    expect(res.status).toBe(200);
    expect(applyPartnerAiSessionOp).toHaveBeenCalledWith({ ...payload, company_code: "XAZ342WG" });
    await expect(res.json()).resolves.toEqual({
      success: true,
      idempotent: false,
      company_code: "XAZ342WG",
      op: "add_topup",
      base_limit: 100,
      base_used: 40,
      topup_balance: 27,
      remaining: 87,
    });
  });

  it("returns idempotent success for a retried event", async () => {
    const { POST } = await loadRoute();
    applyPartnerAiSessionOp.mockResolvedValue({
      idempotent: true,
      companyCode: "XAZ342WG",
      op: "add_topup",
      base_limit: 100,
      base_used: 40,
      topup_balance: 27,
      remaining: 87,
    });

    const res = await POST(jsonRequest(url, payload, { [headerName]: secret }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ success: true, idempotent: true });
  });
});
