import { NextRequest, NextResponse } from "next/server";
import { TENANT_PROVISION_SECRET_HEADER, validateTenantProvisionSecret } from "@/lib/api/tenantProvisionAuth";
import { partnerProvisionTenantSchema } from "@/lib/validation/partnerProvision";
import { env } from "@/lib/env";
import { CompanyCodeTakenError } from "@/lib/services/companyCodeService";
import { AdminEmailTakenError, createTenantOnboarding } from "@/lib/services/tenantService";

/**
 * Partner / core-system provisioning: creates tenant + tenant admin + YOUR company_code.
 * Requires TENANT_PROVISION_SECRET and header x-tenant-provision-secret (timing-safe).
 * Alternative: authenticated POST /api/admin/tenants (platform_admin) auto-generates company_code; `/platform/tenants` has no create form.
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

  try {
    const result = await createTenantOnboarding({
      ...parsed.data,
      hr_contact_email: parsed.data.hr_contact_email || undefined,
      created_by: null,
    });

    const { tenant, adminUser, companyCode, temporaryPassword } = result;
    return NextResponse.json({
      tenant,
      adminUser,
      companyCode,
      temporaryPassword,
      provisioned_company_code: companyCode.code,
    });
  } catch (error) {
    if (error instanceof CompanyCodeTakenError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: 409 });
    }
    if (error instanceof AdminEmailTakenError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: 409 });
    }
    console.error("partner_provision_tenant_error", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to provision tenant." } },
      { status: 500 },
    );
  }
}
