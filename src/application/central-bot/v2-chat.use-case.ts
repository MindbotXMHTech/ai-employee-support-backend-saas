import { checkAiSessionQuota, toAiSessionUsageBody, type AiSessionUsageBody } from "@/lib/domain/aiSessionQuota";
import { consumeAiSession, findAiSessionQuota } from "@/lib/services/aiSessionQuotaService";
import { findActiveTenantByCompanyCode } from "@/lib/services/tenantService";

type CentralBotV2InvalidCompanyBody = {
  success: false;
  error: {
    code: "INVALID_COMPANY_CODE";
    message: string;
  };
};

export type CentralBotV2ChatHttpResult =
  | { statusCode: 404; body: CentralBotV2InvalidCompanyBody }
  | { statusCode: 200; body: AiSessionUsageBody };

/** Spends one AI session for the company and returns the same balance body as GET /api/v2/usage. */
export async function executeCentralBotV2Chat(companyCode: string): Promise<CentralBotV2ChatHttpResult> {
  const tenant = await findActiveTenantByCompanyCode(companyCode);
  if (!tenant) {
    return {
      statusCode: 404,
      body: {
        success: false,
        error: { code: "INVALID_COMPANY_CODE", message: "Invalid or revoked company code." },
      },
    };
  }

  const sessionRow = await findAiSessionQuota(tenant.id);
  const gate = checkAiSessionQuota(sessionRow);
  if (!gate.enrolled || !gate.allowed) {
    return { statusCode: 200, body: toAiSessionUsageBody(sessionRow) };
  }

  const spent = await consumeAiSession(tenant.id);
  return { statusCode: 200, body: toAiSessionUsageBody(spent) };
}
