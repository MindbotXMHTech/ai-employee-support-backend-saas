import { NextRequest, NextResponse } from "next/server";
import { checkPartnerProvisionRateLimit } from "@/lib/api/partnerRateLimit";
import { TENANT_PROVISION_SECRET_HEADER, validateTenantProvisionSecret } from "@/lib/api/tenantProvisionAuth";
import { env } from "@/lib/env";
import { PartnerEventIdConflictError, applyPartnerAiSessionOp } from "@/lib/services/partnerAiSessionService";
import { TenantCompanyCodeNotFoundError } from "@/lib/services/tenantService";
import { partnerAiSessionOpSchema } from "@/lib/validation/partnerProvision";

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

  const parsed = partnerAiSessionOpSchema.safeParse(body);
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
      { error: { code: "RATE_LIMITED", message: "Too many AI session requests." } },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } },
    );
  }

  try {
    const result = await applyPartnerAiSessionOp(parsed.data);
    return NextResponse.json({
      success: true,
      idempotent: result.idempotent,
      company_code: result.companyCode,
      op: result.op,
      base_limit: result.base_limit,
      base_used: result.base_used,
      topup_balance: result.topup_balance,
      remaining: result.remaining,
    });
  } catch (error) {
    if (error instanceof TenantCompanyCodeNotFoundError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 404 },
      );
    }
    if (error instanceof PartnerEventIdConflictError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 409 },
      );
    }
    console.error("partner_ai_session_op_error", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to apply AI session change." } },
      { status: 500 },
    );
  }
}
