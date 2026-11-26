import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { jsonRequest } from "@/test/mockNextRequest";
import { PARTNER_RATE_LIMIT_MAX_PER_COMPANY_CODE, PARTNER_RATE_LIMIT_MAX_PER_IP } from "@/lib/api/partnerRateLimitLogic";

const createPartnerTenantOnboarding = vi.hoisted(() => vi.fn());
const syncTenantPlanFromPartner = vi.hoisted(() => vi.fn());
const revokePartnerProvisionedTenantByCompanyCode = vi.hoisted(() => vi.fn());
const applyPartnerAiSessionOp = vi.hoisted(() => vi.fn());

const secret = "partner-provision-secret-value-32b!!";
const headerName = "x-tenant-provision-secret";

type Post = (request: Request) => Promise<Response>;

function code(index: number): string {
  return `CODE${String(index).padStart(4, "0")}`;
}

function spoofedHeaders(index: number, companyHeader?: string): Record<string, string> {
  const headers: Record<string, string> = {
    [headerName]: secret,
    "x-forwarded-for": `203.0.113.${index}, 10.1.1.1`,
    "x-real-ip": `198.51.100.${index}`,
    "x-vercel-forwarded-for": companyHeader ?? `192.0.2.${index}`,
  };
  return headers;
}

async function statusesFor(
  post: Post,
  url: string,
  bodyFor: (index: number) => unknown,
  headerFor: (index: number) => Record<string, string>,
  count: number,
): Promise<number[]> {
  const statuses: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const response = await post(jsonRequest(url, bodyFor(index), headerFor(index)));
    statuses.push(response.status);
  }
  return statuses;
}

describe("partner address cap", () => {
  beforeEach(() => {
    vi.stubEnv("TENANT_PROVISION_SECRET", secret);
    vi.stubEnv("VERCEL", "");
    vi.resetModules();
    createPartnerTenantOnboarding.mockResolvedValue({
      tenant: { id: "t1", name: "Co", monthly_message_limit: 500, status: "active" },
      companyCode: { code: "ACME99" },
      admin_email: "a@ex.com",
      admin_display_name: "Admin",
    });
    syncTenantPlanFromPartner.mockResolvedValue({
      tenant: { id: "tenant-id", monthly_message_limit: 500, status: "active" },
      companyCode: { code: "ACME99" },
      idempotent: false,
    });
    revokePartnerProvisionedTenantByCompanyCode.mockResolvedValue({
      ok: true,
      code: "REVOKED",
      idempotent: false,
      tenant_id: "t1",
    });
    applyPartnerAiSessionOp.mockResolvedValue({
      idempotent: false,
      companyCode: "ACME99",
      op: "set_base",
      base_limit: 100,
      base_used: 0,
      topup_balance: 0,
      remaining: 100,
    });
  });

  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.doUnmock("@/lib/services/tenantService");
    vi.doUnmock("@/lib/services/partnerAiSessionService");
    createPartnerTenantOnboarding.mockReset();
    syncTenantPlanFromPartner.mockReset();
    revokePartnerProvisionedTenantByCompanyCode.mockReset();
    applyPartnerAiSessionOp.mockReset();
  });

  async function loadCreate(): Promise<Post> {
    vi.doMock("@/lib/services/tenantService", () => ({ createPartnerTenantOnboarding }));
    const { POST } = await import("./route");
    return POST;
  }

  async function loadSync(): Promise<Post> {
    vi.doMock("@/lib/services/tenantService", () => ({ syncTenantPlanFromPartner }));
    const { POST } = await import("./sync-plan/route");
    return POST;
  }

  async function loadRevoke(): Promise<Post> {
    vi.doMock("@/lib/services/tenantService", () => ({ revokePartnerProvisionedTenantByCompanyCode }));
    const { POST } = await import("./revoke/route");
    return POST;
  }

  async function loadAiSessions(): Promise<Post> {
    vi.doMock("@/lib/services/partnerAiSessionService", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/lib/services/partnerAiSessionService")>();
      return { ...actual, applyPartnerAiSessionOp };
    });
    const { POST } = await import("./ai-sessions/route");
    return POST;
  }

  const cases: Array<{
    name: string;
    url: string;
    load: () => Promise<Post>;
    body: (index: number) => unknown;
    downstream: () => { mock: { calls: unknown[] } };
  }> = [
    {
      name: "create",
      url: "http://localhost/api/v1/partner/tenants",
      load: loadCreate,
      body: (index) => ({
        company_code: code(index),
        name: "Acme",
        quota: 500,
        admin_email: "a@ex.com",
        admin_display_name: "Admin",
      }),
      downstream: () => createPartnerTenantOnboarding,
    },
    {
      name: "sync-plan",
      url: "http://localhost/api/v1/partner/tenants/sync-plan",
      load: loadSync,
      body: (index) => ({
        company_code: code(index),
        quota: 500,
        event_id: `evt${index}`,
      }),
      downstream: () => syncTenantPlanFromPartner,
    },
    {
      name: "revoke",
      url: "http://localhost/api/v1/partner/tenants/revoke",
      load: loadRevoke,
      body: (index) => ({ company_code: code(index), event_id: `evt${index}` }),
      downstream: () => revokePartnerProvisionedTenantByCompanyCode,
    },
    {
      name: "ai-sessions",
      url: "http://localhost/api/v1/partner/tenants/ai-sessions",
      load: loadAiSessions,
      body: (index) => ({
        company_code: code(index),
        event_id: `evt${index}`,
        op: "set_base",
        amount: 100,
      }),
      downstream: () => applyPartnerAiSessionOp,
    },
  ];

  it.each(cases)(
    "$name returns 429 after 30 requests when forwarding headers change and the company code changes",
    async ({ url, load, body, downstream }) => {
      const post = await load();
      const statuses = await statusesFor(
        post,
        url,
        body,
        (index) => spoofedHeaders(index),
        PARTNER_RATE_LIMIT_MAX_PER_IP + 1,
      );

      expect(statuses.slice(0, PARTNER_RATE_LIMIT_MAX_PER_IP)).toEqual(
        Array.from({ length: PARTNER_RATE_LIMIT_MAX_PER_IP }, () => 200),
      );
      expect(statuses[PARTNER_RATE_LIMIT_MAX_PER_IP]).toBe(429);
      expect(downstream().mock.calls).toHaveLength(PARTNER_RATE_LIMIT_MAX_PER_IP);
    },
  );

  it.each(cases)(
    "$name returns 429 after 10 requests for one company code when forwarding headers change",
    async ({ url, load, body }) => {
      const post = await load();
      const statuses = await statusesFor(
        post,
        url,
        () => body(1),
        (index) => spoofedHeaders(index),
        PARTNER_RATE_LIMIT_MAX_PER_COMPANY_CODE + 1,
      );

      expect(statuses.slice(0, PARTNER_RATE_LIMIT_MAX_PER_COMPANY_CODE)).toEqual(
        Array.from({ length: PARTNER_RATE_LIMIT_MAX_PER_COMPANY_CODE }, () => 200),
      );
      expect(statuses[PARTNER_RATE_LIMIT_MAX_PER_COMPANY_CODE]).toBe(429);
    },
  );

  it.each(cases)(
    "$name keeps one address bucket when Vercel sets x-vercel-forwarded-for and the client rotates X-Forwarded-For",
    async ({ url, load, body }) => {
      vi.stubEnv("VERCEL", "1");
      const post = await load();
      const samePlatform = (index: number) => spoofedHeaders(index, "203.0.113.10");
      const statuses = await statusesFor(
        post,
        url,
        body,
        samePlatform,
        PARTNER_RATE_LIMIT_MAX_PER_IP + 1,
      );

      expect(statuses[PARTNER_RATE_LIMIT_MAX_PER_IP]).toBe(429);

      const other = await post(
        jsonRequest(url, body(40), {
          ...spoofedHeaders(40, "203.0.113.40"),
        }),
      );
      expect(other.status).toBe(200);
    },
  );
});
