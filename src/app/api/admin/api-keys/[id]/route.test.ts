import { describe, expect, it, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";

const getApiKeyTenantId = vi.hoisted(() => vi.fn());
const revokeApiKey = vi.hoisted(() => vi.fn());
const canManageTenantScopedResource = vi.hoisted(() => vi.fn());
const requireAdminUser = vi.hoisted(() => vi.fn());

describe("DELETE /api/admin/api-keys/[id]", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  function deleteRequest() {
    return new NextRequest("http://localhost/api/admin/api-keys/11111111-1111-4111-8111-111111111111", {
      method: "DELETE",
    });
  }

  it("returns 404 when the API key id does not exist", async () => {
    vi.doMock("@/lib/auth/admin", () => ({ requireAdminUser }));
    vi.doMock("@/lib/services/apiKeyService", () => ({ getApiKeyTenantId, revokeApiKey }));
    vi.doMock("@/lib/auth/tenantScopedAccess", () => ({ canManageTenantScopedResource }));

    requireAdminUser.mockResolvedValue({
      ok: true,
      authUser: {},
      appUser: { id: "u1", role: "platform_admin" },
    });
    getApiKeyTenantId.mockResolvedValue(null);

    const { DELETE } = await import("./route");
    const res = await DELETE(deleteRequest(), {
      params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }),
    });

    expect(res.status).toBe(404);
    expect(revokeApiKey).not.toHaveBeenCalled();
  });

  it("returns 403 when tenant admin cannot manage the key tenant", async () => {
    vi.doMock("@/lib/auth/admin", () => ({ requireAdminUser }));
    vi.doMock("@/lib/services/apiKeyService", () => ({ getApiKeyTenantId, revokeApiKey }));
    vi.doMock("@/lib/auth/tenantScopedAccess", () => ({ canManageTenantScopedResource }));

    requireAdminUser.mockResolvedValue({
      ok: true,
      authUser: {},
      appUser: { id: "u1", role: "tenant_admin" },
    });
    getApiKeyTenantId.mockResolvedValue("22222222-2222-4222-8222-222222222222");
    canManageTenantScopedResource.mockResolvedValue(false);

    const { DELETE } = await import("./route");
    const res = await DELETE(deleteRequest(), {
      params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }),
    });

    expect(res.status).toBe(403);
    expect(revokeApiKey).not.toHaveBeenCalled();
  });

  it("revokes when caller may manage the tenant (tenant admin)", async () => {
    vi.doMock("@/lib/auth/admin", () => ({ requireAdminUser }));
    vi.doMock("@/lib/services/apiKeyService", () => ({ getApiKeyTenantId, revokeApiKey }));
    vi.doMock("@/lib/auth/tenantScopedAccess", () => ({ canManageTenantScopedResource }));

    requireAdminUser.mockResolvedValue({
      ok: true,
      authUser: {},
      appUser: { id: "u1", role: "tenant_admin" },
    });
    getApiKeyTenantId.mockResolvedValue("22222222-2222-4222-8222-222222222222");
    canManageTenantScopedResource.mockResolvedValue(true);

    const { DELETE } = await import("./route");
    const res = await DELETE(deleteRequest(), {
      params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }),
    });

    expect(res.status).toBe(200);
    expect(revokeApiKey).toHaveBeenCalledWith({
      apiKeyId: "11111111-1111-4111-8111-111111111111",
      actorUserId: "u1",
    });
  });
});
