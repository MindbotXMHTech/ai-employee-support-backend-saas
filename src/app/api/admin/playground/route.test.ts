import { describe, expect, it, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { fakePlatformAdmin, fakeTenant, fakeTenantAdmin } from "@/test/fixtures";
import { createTenantMembersSupabaseMock } from "@/test/mockSupabase";

const runRagPlayground = vi.hoisted(() => vi.fn());
const canManageTenantScopedResource = vi.hoisted(() => vi.fn());
const requireAdminUser = vi.hoisted(() => vi.fn());

const tenantA = fakeTenant.id;
const tenantB = "22222222-2222-4222-8222-222222222222";

function postPlayground(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/admin/playground", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/playground", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 403 when tenant admin targets another tenant (SAAS-IDOR-02)", async () => {
    vi.doMock("@/lib/auth/admin", () => ({ requireAdminUser }));
    vi.doMock("@/lib/auth/tenantScopedAccess", () => ({ canManageTenantScopedResource }));
    vi.doMock("@/lib/services/playgroundService", () => ({ runRagPlayground }));

    requireAdminUser.mockResolvedValue({
      ok: true,
      authUser: {},
      appUser: { id: "u1", role: "tenant_admin" },
    });
    canManageTenantScopedResource.mockResolvedValue(false);

    const { POST } = await import("./route");
    const res = await POST(
      postPlayground({ tenant_id: tenantB, message: "ลาป่วยได้กี่วัน" }),
    );

    expect(res.status).toBe(403);
    expect(canManageTenantScopedResource).toHaveBeenCalledWith({
      tenantId: tenantB,
      appUser: { id: "u1", role: "tenant_admin" },
    });
    expect(runRagPlayground).not.toHaveBeenCalled();
  });

  it("runs playground when tenant admin may manage the tenant", async () => {
    vi.doMock("@/lib/auth/admin", () => ({ requireAdminUser }));
    vi.doMock("@/lib/auth/tenantScopedAccess", () => ({ canManageTenantScopedResource }));
    vi.doMock("@/lib/services/playgroundService", () => ({ runRagPlayground }));

    requireAdminUser.mockResolvedValue({
      ok: true,
      authUser: {},
      appUser: { id: "u1", role: "tenant_admin" },
    });
    canManageTenantScopedResource.mockResolvedValue(true);
    runRagPlayground.mockResolvedValue({
      reply: "test",
      sources: [],
      model_used: "gpt-4o-mini",
      input_tokens: 1,
      output_tokens: 1,
      total_tokens: 2,
      estimated_cost_usd: 0,
      message_type: "rag",
    });

    const { POST } = await import("./route");
    const res = await POST(
      postPlayground({ tenant_id: tenantA, message: "ลาป่วยได้กี่วัน" }),
    );

    expect(res.status).toBe(200);
    expect(canManageTenantScopedResource).toHaveBeenCalledWith({
      tenantId: tenantA,
      appUser: { id: "u1", role: "tenant_admin" },
    });
    expect(runRagPlayground).toHaveBeenCalledWith({
      tenantId: tenantA,
      message: "ลาป่วยได้กี่วัน",
      botId: undefined,
    });
  });

  it("allows platform_admin to target any tenant_id", async () => {
    vi.doMock("@/lib/auth/admin", () => ({ requireAdminUser }));
    vi.doMock("@/lib/auth/tenantScopedAccess", () => ({ canManageTenantScopedResource }));
    vi.doMock("@/lib/services/playgroundService", () => ({ runRagPlayground }));

    requireAdminUser.mockResolvedValue({
      ok: true,
      authUser: {},
      appUser: { id: "p1", role: "platform_admin" },
    });
    canManageTenantScopedResource.mockResolvedValue(true);
    runRagPlayground.mockResolvedValue({ reply: "ok", sources: [] });

    const { POST } = await import("./route");
    const res = await POST(
      postPlayground({ tenant_id: tenantB, message: "test" }),
    );

    expect(res.status).toBe(200);
    expect(runRagPlayground).toHaveBeenCalledWith({
      tenantId: tenantB,
      message: "test",
      botId: undefined,
    });
  });

  it("does not invoke RAG when unauthenticated", async () => {
    vi.doMock("@/lib/auth/admin", () => ({ requireAdminUser }));
    vi.doMock("@/lib/auth/tenantScopedAccess", () => ({ canManageTenantScopedResource }));
    vi.doMock("@/lib/services/playgroundService", () => ({ runRagPlayground }));

    requireAdminUser.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    });

    const { POST } = await import("./route");
    const res = await POST(
      postPlayground({ tenant_id: tenantA, message: "test" }),
    );

    expect(res.status).toBe(401);
    expect(canManageTenantScopedResource).not.toHaveBeenCalled();
    expect(runRagPlayground).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/playground — real canManageTenantScopedResource", () => {
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
    vi.doMock("@/lib/services/playgroundService", () => ({ runRagPlayground }));
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
      postPlayground({ tenant_id: tenantB, message: "ลาป่วยได้กี่วัน" }),
    );

    expect(res.status).toBe(403);
    expect(runRagPlayground).not.toHaveBeenCalled();
  });

  it("runs playground when Supabase reports active membership", async () => {
    const supabaseMock = createTenantMembersSupabaseMock({ id: "member-1" });

    requireAdminUser.mockResolvedValue({
      ok: true,
      authUser: {},
      appUser: fakeTenantAdmin,
    });
    runRagPlayground.mockResolvedValue({ reply: "ok", sources: [] });

    const { POST } = await importPostWithRealTenantAccess(supabaseMock);
    const res = await POST(
      postPlayground({ tenant_id: tenantA, message: "ลาป่วยได้กี่วัน" }),
    );

    expect(res.status).toBe(200);
    expect(runRagPlayground).toHaveBeenCalledWith({
      tenantId: tenantA,
      message: "ลาป่วยได้กี่วัน",
      botId: undefined,
    });
  });

  it("allows platform_admin without querying tenant_members", async () => {
    const createSupabaseServiceClient = vi.fn();
    const supabaseMock = { createSupabaseServiceClient };

    requireAdminUser.mockResolvedValue({
      ok: true,
      authUser: {},
      appUser: fakePlatformAdmin,
    });
    runRagPlayground.mockResolvedValue({ reply: "ok", sources: [] });

    const { POST } = await importPostWithRealTenantAccess(supabaseMock);
    const res = await POST(
      postPlayground({ tenant_id: tenantB, message: "test" }),
    );

    expect(res.status).toBe(200);
    expect(createSupabaseServiceClient).not.toHaveBeenCalled();
    expect(runRagPlayground).toHaveBeenCalled();
  });
});
