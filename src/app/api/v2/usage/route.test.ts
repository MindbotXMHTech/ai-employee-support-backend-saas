import { afterEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { AI_SESSION_NOT_PROVISIONED_MESSAGE } from "@/lib/domain/aiSessionQuota";
import { fakeTenant } from "@/test/fixtures";
import { getRequest } from "@/test/mockNextRequest";

const findActiveTenantByCompanyCode = vi.hoisted(() => vi.fn());

describe("GET /api/v2/usage", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    findActiveTenantByCompanyCode.mockReset();
  });

  function mockAuthOk() {
    vi.doMock("@/lib/api/auth", () => ({
      authenticateCentralBotRequest: vi.fn(async () => ({ ok: true })),
    }));
    vi.doMock("@/lib/services/tenantService", () => ({
      findActiveTenantByCompanyCode,
    }));
  }

  it("says the session is not provisioned when the company has no session row", async () => {
    mockAuthOk();
    findActiveTenantByCompanyCode.mockResolvedValue(fakeTenant);
    const findAiSessionQuota = vi.fn(async () => null);
    vi.doMock("@/lib/services/aiSessionQuotaService", () => ({
      findAiSessionQuota,
      toAiSessionSnapshot: vi.fn(),
    }));

    const { GET } = await import("./route");
    const response = await GET(
      getRequest("http://localhost/api/v2/usage?company_code=acme01", {
        "x-central-bot-secret": "secret",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ai_session: null,
      message: AI_SESSION_NOT_PROVISIONED_MESSAGE,
    });
    expect(findActiveTenantByCompanyCode).toHaveBeenCalledWith("ACME01");
    expect(findAiSessionQuota).toHaveBeenCalledWith(fakeTenant.id);
  });

  it("returns the AI session snapshot without spending a unit", async () => {
    mockAuthOk();
    findActiveTenantByCompanyCode.mockResolvedValue(fakeTenant);
    const consumeAiSession = vi.fn();
    vi.doMock("@/lib/services/aiSessionQuotaService", () => ({
      findAiSessionQuota: vi.fn(async () => ({
        base_limit: 10,
        base_used: 4,
        topup_balance: 2,
        updated_at: "2026-11-05T00:00:00.000Z",
      })),
      consumeAiSession,
      toAiSessionSnapshot: (row: { base_limit: number; base_used: number; topup_balance: number }) => ({
        base_remaining: Math.max(row.base_limit - row.base_used, 0),
        topup_balance: row.topup_balance,
        remaining: Math.max(row.base_limit - row.base_used, 0) + row.topup_balance,
      }),
    }));

    const { GET } = await import("./route");
    const response = await GET(
      getRequest("http://localhost/api/v2/usage?company_code=ACME01", {
        "x-central-bot-secret": "secret",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ai_session: { base_remaining: 6, topup_balance: 2, remaining: 8 },
    });
    expect(consumeAiSession).not.toHaveBeenCalled();
    expect(findActiveTenantByCompanyCode).toHaveBeenCalledWith("ACME01");
  });

  it("rejects an unknown or revoked company code before reading the session bucket", async () => {
    mockAuthOk();
    findActiveTenantByCompanyCode.mockResolvedValue(null);
    const findAiSessionQuota = vi.fn();
    vi.doMock("@/lib/services/aiSessionQuotaService", () => ({
      findAiSessionQuota,
      toAiSessionSnapshot: vi.fn(),
    }));

    const { GET } = await import("./route");
    const response = await GET(
      getRequest("http://localhost/api/v2/usage?company_code=MISSING", {
        "x-central-bot-secret": "secret",
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: { code: "INVALID_COMPANY_CODE", message: "Invalid or revoked company code." },
    });
    expect(findAiSessionQuota).not.toHaveBeenCalled();
  });

  it("rejects a missing or malformed company code before lookup", async () => {
    mockAuthOk();
    vi.doMock("@/lib/services/aiSessionQuotaService", () => ({
      findAiSessionQuota: vi.fn(),
      toAiSessionSnapshot: vi.fn(),
    }));

    const { GET } = await import("./route");
    const missing = await GET(
      getRequest("http://localhost/api/v2/usage", { "x-central-bot-secret": "secret" }),
    );
    const malformed = await GET(
      getRequest("http://localhost/api/v2/usage?company_code=ab", { "x-central-bot-secret": "secret" }),
    );

    expect(missing.status).toBe(400);
    await expect(missing.json()).resolves.toEqual({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "company_code must be at least 4 characters" },
    });
    expect(malformed.status).toBe(400);
    await expect(malformed.json()).resolves.toMatchObject({
      success: false,
      error: { code: "VALIDATION_ERROR" },
    });
    expect(findActiveTenantByCompanyCode).not.toHaveBeenCalled();
  });

  it("rejects a bad central bot secret before lookup", async () => {
    const findAiSessionQuota = vi.fn();
    vi.doMock("@/lib/api/auth", () => ({
      authenticateCentralBotRequest: vi.fn(async () => ({
        ok: false,
        response: NextResponse.json(
          { success: false, error: { code: "INVALID_API_KEY", message: "Invalid central bot secret." } },
          { status: 401 },
        ),
      })),
    }));
    vi.doMock("@/lib/services/tenantService", () => ({
      findActiveTenantByCompanyCode,
    }));
    vi.doMock("@/lib/services/aiSessionQuotaService", () => ({
      findAiSessionQuota,
      toAiSessionSnapshot: vi.fn(),
    }));

    const { GET } = await import("./route");
    const response = await GET(
      getRequest("http://localhost/api/v2/usage?company_code=ACME01", {
        "x-central-bot-secret": "wrong",
      }),
    );

    expect(response.status).toBe(401);
    expect(findActiveTenantByCompanyCode).not.toHaveBeenCalled();
    expect(findAiSessionQuota).not.toHaveBeenCalled();
  });
});