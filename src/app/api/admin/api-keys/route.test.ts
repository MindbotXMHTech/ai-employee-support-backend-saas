import { describe, expect, it, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { fakeTenant, fakeTenantAdmin } from "@/test/fixtures";
import { createTenantMembersSupabaseMock } from "@/test/mockSupabase";

const createApiKey = vi.hoisted(() => vi.fn());
const canManageTenantScopedResource = vi.hoisted(() => vi.fn());
const requireAdminUser = vi.hoisted(() => vi.fn());

const tenantA = fakeTenant.id;
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

describe("POST /api/admin/api-keys — real canManageTenantScopedResource", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  async function importPostWithRealTenantAccess(supabaseMock: { createSupabaseServiceClient: () => unknown }) {
    vi.doMock("@/lib/supabase/server", () => supabaseMock);
    vi.doMock("@/lib/auth/tenantScopedAccess", async (importOriginal) =>
      importOriginal<typeof import("@/lib/auth/tenantScopedAccess")>(),
    );
    vi.doMock("@/lib/auth/admin", () => ({ requireAdminUser }));
    vi.doMock("@/lib/services/apiKeyService", () => ({ createApiKey }));
    return import("./route");
  }

  it("returns 403 when Supabase reports no active membership", async () => {
    const supabaseMock = createTenantMembersSupabaseMock(null);

    requireAdminUser.mockResolvedValue({
      ok: true,
      authUser: {},
      appUser: fakeTenantAdmin,
    });

    const { POST } = await importPostWithRealTenantAccess(supabaseMock);
    const res = await POST(
      postApiKey({ tenant_id: tenantB, name: "stolen-key" }),
    );

    expect(res.status).toBe(403);
    expect(createApiKey).not.toHaveBeenCalled();
  });

  it("creates a key when Supabase reports active membership", async () => {
    const supabaseMock = createTenantMembersSupabaseMock({ id: "member-1" });

    requireAdminUser.mockResolvedValue({
      ok: true,
      authUser: {},
      appUser: fakeTenantAdmin,
    });
    createApiKey.mockResolvedValue({ id: "key-1", name: "my-key" });

    const { POST } = await importPostWithRealTenantAccess(supabaseMock);
    const res = await POST(
      postApiKey({ tenant_id: tenantA, name: "my-key" }),
    );

    expect(res.status).toBe(200);
    expect(createApiKey).toHaveBeenCalledWith({
      tenantId: tenantA,
      name: "my-key",
      createdBy: fakeTenantAdmin.id,
    });
  });
});
