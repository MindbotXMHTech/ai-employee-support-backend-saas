import { NextRequest, NextResponse } from "next/server";
import { checkPartnerProvisionRateLimit } from "@/lib/api/partnerRateLimit";
import { TENANT_PROVISION_SECRET_HEADER, validateTenantProvisionSecret } from "@/lib/api/tenantProvisionAuth";
import { env } from "@/lib/env";
import {
  PartnerTenantRevokeForbiddenError,
  revokePartnerProvisionedTenantByCompanyCode,
} from "@/lib/services/tenantService";
import { partnerRevokeTenantSchema } from "@/lib/validation/partnerProvision";

/**
 * Compensating revoke when Mindbloom local company mirror fails after partner create.
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

  const parsed = partnerRevokeTenantSchema.safeParse(body);
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
      { error: { code: "RATE_LIMITED", message: "Too many provisioning requests." } },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } },
    );
  }

  try {
    const result = await revokePartnerProvisionedTenantByCompanyCode(parsed.data);
    return NextResponse.json({
      success: true,
      company_code: parsed.data.company_code,
      result: result.code,
      tenant_id: result.tenant_id,
      idempotent: result.idempotent,
    });
  } catch (error) {
    if (error instanceof PartnerTenantRevokeForbiddenError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: 403 });
    }
    console.error("partner_revoke_tenant_error", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to revoke partner tenant." } },
      { status: 500 },
    );
  }
}
