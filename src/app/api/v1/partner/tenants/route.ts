import { NextRequest, NextResponse } from "next/server";
import { checkPartnerProvisionRateLimit } from "@/lib/api/partnerRateLimit";
import { TENANT_PROVISION_SECRET_HEADER, validateTenantProvisionSecret } from "@/lib/api/tenantProvisionAuth";
import { partnerProvisionTenantSchema } from "@/lib/validation/partnerProvision";
import { env } from "@/lib/env";
import { CompanyCodeTakenError } from "@/lib/services/companyCodeService";
import { createPartnerTenantOnboarding } from "@/lib/services/tenantService";

/**
 * Partner / core-system provisioning: creates runtime tenant with caller-supplied company code + quota.
 * Mindbloom owns plan/status/admin credentials — no SaaS auth user or temporaryPassword in response.
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

  const parsed = partnerProvisionTenantSchema.safeParse(body);
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
    const result = await createPartnerTenantOnboarding({
      ...parsed.data,
      hr_contact_email: parsed.data.hr_contact_email || undefined,
      created_by: null,
    });

    const { tenant, companyCode, admin_email, admin_display_name } = result;
    return NextResponse.json({
      tenant,
      companyCode,
      admin_email,
      admin_display_name,
      provisioned_company_code: companyCode.code,
      quota: parsed.data.quota,
    });
  } catch (error) {
    if (error instanceof CompanyCodeTakenError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: 409 });
    }
    console.error("partner_provision_tenant_error", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to provision tenant." } },
      { status: 500 },
    );
  }
}
