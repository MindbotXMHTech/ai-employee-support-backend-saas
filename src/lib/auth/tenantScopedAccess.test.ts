import { afterEach, describe, expect, it, vi } from "vitest";
import { fakePlatformAdmin, fakeTenant, fakeTenantAdmin } from "@/test/fixtures";
import { createTenantMembersSupabaseMock } from "@/test/mockSupabase";

describe("canManageTenantScopedResource", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns true for platform_admin without querying tenant_members", async () => {
    const createSupabaseServiceClient = vi.fn();

    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceClient,
    }));

    const { canManageTenantScopedResource } = await import("./tenantScopedAccess");
    const allowed = await canManageTenantScopedResource({
      tenantId: fakeTenant.id,
      appUser: fakePlatformAdmin,
    });

    expect(allowed).toBe(true);
    expect(createSupabaseServiceClient).not.toHaveBeenCalled();
  });

  it("returns true when tenant admin has active membership", async () => {
    const { createSupabaseServiceClient, eqCalls } = createTenantMembersSupabaseMock({ id: "member-1" });

    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceClient,
    }));

    const { canManageTenantScopedResource } = await import("./tenantScopedAccess");
    const allowed = await canManageTenantScopedResource({
      tenantId: fakeTenant.id,
      appUser: fakeTenantAdmin,
    });

    expect(allowed).toBe(true);
    expect(eqCalls).toEqual([
      { column: "tenant_id", value: fakeTenant.id },
      { column: "user_id", value: fakeTenantAdmin.id },
      { column: "status", value: "active" },
    ]);
  });

  it("returns false when there is no membership row", async () => {
    const { createSupabaseServiceClient } = createTenantMembersSupabaseMock(null);

    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceClient,
    }));

    const { canManageTenantScopedResource } = await import("./tenantScopedAccess");
    const allowed = await canManageTenantScopedResource({
      tenantId: fakeTenant.id,
      appUser: fakeTenantAdmin,
    });

    expect(allowed).toBe(false);
  });

  it("returns false when membership is not active (invited/disabled filtered by query)", async () => {
    const { createSupabaseServiceClient, eqCalls } = createTenantMembersSupabaseMock(null);

    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceClient,
    }));

    const { canManageTenantScopedResource } = await import("./tenantScopedAccess");
    const allowed = await canManageTenantScopedResource({
      tenantId: fakeTenant.id,
      appUser: fakeTenantAdmin,
    });

    expect(allowed).toBe(false);
    expect(eqCalls.some((c) => c.column === "status" && c.value === "active")).toBe(true);
  });
});
