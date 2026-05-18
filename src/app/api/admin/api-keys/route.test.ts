import { describe, expect, it, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";

const createApiKey = vi.hoisted(() => vi.fn());
const canManageTenantScopedResource = vi.hoisted(() => vi.fn());
const requireAdminUser = vi.hoisted(() => vi.fn());

const tenantA = "11111111-1111-4111-8111-111111111111";
const tenantB = "22222222-2222-4222-8222-222222222222";

function postApiKey(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/admin/api-keys", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/api-keys", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 403 when tenant admin creates a key for another tenant (SAAS-IDOR-01)", async () => {
    vi.doMock("@/lib/auth/admin", () => ({ requireAdminUser }));
    vi.doMock("@/lib/auth/tenantScopedAccess", () => ({ canManageTenantScopedResource }));
    vi.doMock("@/lib/services/apiKeyService", () => ({ createApiKey }));

    requireAdminUser.mockResolvedValue({
      ok: true,
      authUser: {},
      appUser: { id: "u1", role: "tenant_admin" },
    });
    canManageTenantScopedResource.mockResolvedValue(false);

    const { POST } = await import("./route");
    const res = await POST(
      postApiKey({ tenant_id: tenantB, name: "stolen-key" }),
    );

    expect(res.status).toBe(403);
    expect(canManageTenantScopedResource).toHaveBeenCalledWith({
      tenantId: tenantB,
      appUser: { id: "u1", role: "tenant_admin" },
    });
    expect(createApiKey).not.toHaveBeenCalled();
  });

  it("creates a key when tenant admin may manage the tenant", async () => {
    vi.doMock("@/lib/auth/admin", () => ({ requireAdminUser }));
    vi.doMock("@/lib/auth/tenantScopedAccess", () => ({ canManageTenantScopedResource }));
    vi.doMock("@/lib/services/apiKeyService", () => ({ createApiKey }));

    requireAdminUser.mockResolvedValue({
      ok: true,
      authUser: {},
      appUser: { id: "u1", role: "tenant_admin" },
    });
    canManageTenantScopedResource.mockResolvedValue(true);
    createApiKey.mockResolvedValue({ id: "key-1", name: "my-key" });

    const { POST } = await import("./route");
    const res = await POST(
      postApiKey({ tenant_id: tenantA, name: "my-key" }),
    );

    expect(res.status).toBe(200);
    expect(createApiKey).toHaveBeenCalledWith({
      tenantId: tenantA,
      name: "my-key",
      createdBy: "u1",
    });
  });
});
