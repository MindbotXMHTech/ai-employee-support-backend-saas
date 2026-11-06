import { NextRequest, NextResponse } from "next/server";
import { authenticateCentralBotRequest } from "@/lib/api/auth";
import { toAiSessionUsageBody } from "@/lib/domain/aiSessionQuota";
import { findAiSessionQuota } from "@/lib/services/aiSessionQuotaService";
import { findActiveTenantByCompanyCode } from "@/lib/services/tenantService";
import { companyCodeField } from "@/lib/validation/partnerProvision";

const INVALID_COMPANY_CODE = {
  success: false,
  error: { code: "INVALID_COMPANY_CODE", message: "Invalid or revoked company code." },
} as const;

export async function GET(request: NextRequest) {
  const auth = await authenticateCentralBotRequest(request);
  if (!auth.ok) return auth.response;

  const parsed = companyCodeField.safeParse(request.nextUrl.searchParams.get("company_code") ?? "");
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "company_code must be at least 4 characters";
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message } },
      { status: 400 },
    );
  }

  const tenant = await findActiveTenantByCompanyCode(parsed.data);
  if (!tenant) {
    return NextResponse.json(INVALID_COMPANY_CODE, { status: 404 });
  }

  const sessionRow = await findAiSessionQuota(tenant.id);
  return NextResponse.json(toAiSessionUsageBody(sessionRow));
}
