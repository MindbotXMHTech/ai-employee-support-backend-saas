import { NextRequest, NextResponse } from "next/server";
import { checkPartnerProvisionRateLimit } from "@/lib/api/partnerRateLimit";
import { TENANT_PROVISION_SECRET_HEADER, validateTenantProvisionSecret } from "@/lib/api/tenantProvisionAuth";
import { env } from "@/lib/env";
import { TenantCompanyCodeNotFoundError, syncTenantPlanFromPartner } from "@/lib/services/tenantService";
import { partnerTenantPlanSyncSchema } from "@/lib/validation/partnerProvision";

/**
 * Partner quota sync: updates SaaS runtime monthly_message_limit + derived status by company code.
 */
export async function POST(request: NextRequest) {
  if (!env.TENANT_PROVISION_SECRET?.trim()) {
    return NextResponse.json(
      {
        error: {
          code: "PROVISIONING_DISABLED",
          message:
            "Partner tenant provisioning is not configured. Set TENANT_PROVISION_SECRET in the server environment.",
        },
      },
      { status: 503 },
    );
  }

  if (!validateTenantProvisionSecret(request.headers.get(TENANT_PROVISION_SECRET_HEADER))) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid or missing provisioning secret." } },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid JSON body." } },
      { status: 400 },
    );
  }

  const parsed = partnerTenantPlanSyncSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 400 },
    );
  }

  const rateLimit = checkPartnerProvisionRateLimit({
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip"),
    companyCode: parsed.data.company_code,
  });
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many sync requests." } },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } },
    );
  }

  try {
    const result = await syncTenantPlanFromPartner(parsed.data);
    return NextResponse.json({
      success: true,
      idempotent: result.idempotent,
      tenant: result.tenant,
      company_code: result.companyCode.code,
    });
  } catch (error) {
    if (error instanceof TenantCompanyCodeNotFoundError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 404 },
      );
    }
    console.error("partner_sync_tenant_plan_error", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to sync tenant quota." } },
      { status: 500 },
    );
  }
}
