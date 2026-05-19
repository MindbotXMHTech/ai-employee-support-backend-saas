import { NextRequest, NextResponse } from "next/server";
import { authenticateBotRequest, authenticateCentralBotRequest } from "@/lib/api/auth";
import { buildTenantConflictErrorBody, resolveTenantForCentralBot } from "@/lib/services/centralBotService";
import { getTenantAiSettings } from "@/lib/services/platformAiSettingsService";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
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
    if (!resolved.ok) {
      if (resolved.reason === "tenant_conflict") {
        return NextResponse.json(buildTenantConflictErrorBody(), { status: 409 });
      }
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

  const supabase = createSupabaseServiceClient();
  const [{ data: profile }, aiSettings] = await Promise.all([
    supabase.from("tenant_profiles").select("*").eq("tenant_id", tenant.id).maybeSingle(),
    getTenantAiSettings(tenant.id),
  ]);

  return NextResponse.json({
    company_name: profile?.company_name ?? tenant.name,
    bot_name: aiSettings.name,
    default_language: aiSettings.default_language ?? profile?.default_language ?? "th",
    features: {
      rag_enabled: aiSettings.rag_enabled,
      mental_health_enabled: aiSettings.mental_health_enabled,
      safety_enabled: aiSettings.safety_enabled,
      handoff_enabled: aiSettings.handoff_enabled,
    },
    limits: {
      plan: tenant.plan,
      message_limit: tenant.monthly_message_limit,
    },
  });
}
