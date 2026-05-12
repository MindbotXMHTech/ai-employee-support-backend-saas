import { env } from "@/lib/env";

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 400;

export type MindbloomProvisionPayload = {
  company_code: string;
  tenant_id: string;
  tenant_name: string;
  /** Optional; when omitted or empty, Mindbloom leaves departments unchanged. */
  departments?: string[];
};

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Pushes tenant + company code to Mindbloom `saas-company-provision` (server-to-server).
 * Best-effort: swallows errors after retries; never throws.
 */
export async function pushMindbloomCompanyProvision(input: MindbloomProvisionPayload): Promise<void> {
  const url = env.MINDBLOOM_PROVISION_URL?.trim();
  const secret = env.MINDBLOOM_PROVISION_SECRET?.trim();
  if (!url || !secret) {
    return;
  }

  const body = {
    company_code: input.company_code.trim().toUpperCase(),
    tenant_id: input.tenant_id,
    tenant_name: input.tenant_name,
    departments: input.departments ?? [],
  };

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      if (res.ok) {
        console.info("mindbloom_provision_ok", { tenant_id: input.tenant_id, attempt });
        return;
      }
      const retryable = res.status >= 500 || res.status === 429;
      console.error("mindbloom_provision_http_error", {
        tenant_id: input.tenant_id,
        status: res.status,
        attempt,
        retryable,
        body_preview: text.slice(0, 500),
      });
      if (!retryable) {
        return;
      }
      lastError = new Error(`HTTP ${res.status}`);
    } catch (error) {
      lastError = error;
      console.error("mindbloom_provision_fetch_error", { tenant_id: input.tenant_id, attempt, error });
    }
    if (attempt < MAX_ATTEMPTS) {
      await sleep(BASE_DELAY_MS * 2 ** (attempt - 1));
    }
  }
  console.error("mindbloom_provision_exhausted", { tenant_id: input.tenant_id, error: lastError });
}
