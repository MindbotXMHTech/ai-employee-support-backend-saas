import { afterEach, describe, expect, it, vi } from "vitest";

describe("pushMindbloomCompanyProvision", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.MINDBLOOM_PROVISION_URL;
    delete process.env.MINDBLOOM_PROVISION_SECRET;
    vi.resetModules();
  });

  it("no-ops when URL or secret is missing", async () => {
    delete process.env.MINDBLOOM_PROVISION_URL;
    delete process.env.MINDBLOOM_PROVISION_SECRET;
    vi.resetModules();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { pushMindbloomCompanyProvision } = await import("./mindbloomProvisionService");
    await pushMindbloomCompanyProvision({
      company_code: "AB12",
      tenant_id: "00000000-0000-4000-8000-000000000001",
      tenant_name: "Acme",
      plan: "trial",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("retries on 503 then succeeds", async () => {
    process.env.MINDBLOOM_PROVISION_URL = "https://example.test/provision";
    process.env.MINDBLOOM_PROVISION_SECRET = "test-secret-value-12345";
    vi.resetModules();

    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        if (calls < 2) {
          return new Response("bad", { status: 503 });
        }
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }),
    );

    const { pushMindbloomCompanyProvision } = await import("./mindbloomProvisionService");
    await pushMindbloomCompanyProvision({
      company_code: "ab12",
      tenant_id: "00000000-0000-4000-8000-000000000001",
      tenant_name: "Acme",
      plan: "pro",
    });

    expect(calls).toBe(2);
    expect(fetch).toHaveBeenCalledWith(
      "https://example.test/provision",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-secret-value-12345",
        }),
        body: JSON.stringify({
          company_code: "AB12",
          tenant_id: "00000000-0000-4000-8000-000000000001",
          tenant_name: "Acme",
          plan: "pro",
          departments: [],
        }),
      }),
    );
  });
});
