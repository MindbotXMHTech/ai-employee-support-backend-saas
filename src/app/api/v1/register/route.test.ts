import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonRequest } from "@/test/mockNextRequest";

describe("POST /api/v1/register", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("returns 409 TENANT_CONFLICT when employee is already linked to another tenant", async () => {
    vi.doMock("@/lib/api/auth", () => ({
      authenticateCentralBotRequest: vi.fn(async () => ({ ok: true })),
    }));
    vi.doMock("@/lib/services/centralBotService", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/lib/services/centralBotService")>();
      return {
        ...actual,
        registerEmployeeTenantLink: vi.fn(async () => {
          throw new actual.TenantConflictError();
        }),
      };
    });

    const { POST } = await import("./route");
    const response = await POST(
      jsonRequest(
        "http://localhost/api/v1/register",
        {
          line_user_id: "Uxxxxxxxxxxxxxxxx",
          channel: "line",
          company_code: "OTHERCO",
        },
        { "x-central-bot-secret": "secret" },
      ),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: {
        code: "TENANT_CONFLICT",
        message:
          "Unable to link this account. Contact your administrator if you need to change companies.",
      },
    });
  });
});
