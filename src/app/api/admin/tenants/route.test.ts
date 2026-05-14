import { afterEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { fakePlatformAdmin, fakeTenantAdmin } from "@/test/fixtures";
import { jsonRequest } from "@/test/mockNextRequest";

const createTenantPayload = {
  name: "Acme Thailand",
  plan: "trial",
  admin_email: "admin@acme.example",
  admin_display_name: "Acme Admin",
};

describe("POST /api/admin/tenants", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("rejects unauthenticated users", async () => {
    const createTenantOnboarding = vi.fn();
    vi.doMock("@/lib/auth/admin", () => ({
      requireAdminUser: vi.fn(async () => ({
        ok: false,
        response: NextResponse.json({ error: "Authentication required." }, { status: 401 }),
      })),
    }));
    vi.doMock("@/lib/services/tenantService", () => ({
      createTenantOnboarding,
    }));

    const { POST } = await import("./route");
    const response = await POST(jsonRequest("http://localhost/api/admin/tenants", createTenantPayload));

    expect(response.status).toBe(401);
    expect(createTenantOnboarding).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({ error: "Authentication required." });
  });

  it("rejects tenant admins from platform tenant creation", async () => {
    const createTenantOnboarding = vi.fn();
    vi.doMock("@/lib/auth/admin", () => ({
      requireAdminUser: vi.fn(async () => ({ ok: true, appUser: fakeTenantAdmin, authUser: { id: "auth-user" } })),
    }));
    vi.doMock("@/lib/services/tenantService", () => ({
      createTenantOnboarding,
    }));

    const { POST } = await import("./route");
    const response = await POST(jsonRequest("http://localhost/api/admin/tenants", createTenantPayload));

    expect(response.status).toBe(403);
    expect(createTenantOnboarding).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({ error: "Platform admin required." });
  });

  it("allows platform admins to create tenants with creator attribution", async () => {
    const result = { tenant: { id: "tenant-id" }, temporaryPassword: "temp-password" };
    const createTenantOnboarding = vi.fn(async () => result);
    vi.doMock("@/lib/auth/admin", () => ({
      requireAdminUser: vi.fn(async () => ({ ok: true, appUser: fakePlatformAdmin, authUser: { id: "auth-user" } })),
    }));
    vi.doMock("@/lib/services/tenantService", () => ({
      createTenantOnboarding,
    }));

    const { POST } = await import("./route");
    const response = await POST(jsonRequest("http://localhost/api/admin/tenants", createTenantPayload));

    expect(response.status).toBe(200);
    expect(createTenantOnboarding).toHaveBeenCalledWith({ ...createTenantPayload, status: "active", created_by: fakePlatformAdmin.id });
    await expect(response.json()).resolves.toEqual(result);
  });
});
