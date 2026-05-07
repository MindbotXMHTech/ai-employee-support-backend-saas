import { NextRequest, NextResponse } from "next/server";
import { authenticateBotRequest, authenticateCentralBotRequest } from "@/lib/api/auth";
import { resolveTenantForCentralBot } from "@/lib/services/centralBotService";
import { getQuotaSnapshot, currentMonthStart } from "@/lib/services/quotaService";
import { usageSummary } from "@/lib/services/usageService";
import type { Tenant } from "@/lib/types";

export async function GET(request: NextRequest) {
  let tenant: Tenant;

  if (request.headers.has("x-central-bot-secret")) {
    const auth = await authenticateCentralBotRequest(request);
    if (!auth.ok) return auth.response;

    const { searchParams } = request.nextUrl;
    const externalUserId = searchParams.get("external_user_id");
    if (!externalUserId) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Missing external_user_id." } },
        { status: 400 },
      );
    }

    const resolved = await resolveTenantForCentralBot({
      externalUserId,
      channel: searchParams.get("channel") ?? "api",
      companyCode: searchParams.get("company_code") ?? undefined,
    });
    if (!resolved?.tenant) {
      return NextResponse.json(
        { success: false, error: { code: "TENANT_NOT_RESOLVED", message: "Company code is required for this employee." } },
        { status: 404 },
      );
    }
    tenant = resolved.tenant;
  } else {
    const auth = await authenticateBotRequest(request);
    if (!auth.ok) return auth.response;
    tenant = auth.tenant;
  }

  const [quota, usage] = await Promise.all([getQuotaSnapshot(tenant), usageSummary(tenant.id, currentMonthStart())]);

  return NextResponse.json({
    plan: tenant.plan,
    status: tenant.status,
    messages_used: quota.used,
    messages_limit: quota.limit,
    messages_remaining: quota.remaining,
    estimated_cost_usd: Number(usage.estimatedCostUsd.toFixed(6)),
  });
}
