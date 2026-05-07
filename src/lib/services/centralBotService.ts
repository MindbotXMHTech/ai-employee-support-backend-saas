import crypto from "node:crypto";
import { env } from "@/lib/env";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { Tenant } from "@/lib/types";

export function validateCentralBotSecret(secret: string | null) {
  if (!env.CENTRAL_BOT_SECRET || !secret) return false;
  const actual = Buffer.from(secret);
  const expected = Buffer.from(env.CENTRAL_BOT_SECRET);
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

export async function resolveTenantForCentralBot(input: {
  externalUserId: string;
  channel: string;
  companyCode?: string;
}) {
  const supabase = createSupabaseServiceClient();

  const { data: existingLink } = await supabase
    .from("employee_tenant_links")
    .select("tenant_id, tenants(*)")
    .eq("external_user_id", input.externalUserId)
    .eq("channel", input.channel)
    .maybeSingle();

  if (existingLink?.tenant_id) {
    return {
      tenant: Array.isArray(existingLink.tenants) ? existingLink.tenants[0] : existingLink.tenants,
      linked: true,
    };
  }

  if (!input.companyCode) {
    return null;
  }

  const registered = await registerEmployeeTenantLink({
    externalUserId: input.externalUserId,
    channel: input.channel,
    companyCode: input.companyCode,
  });

  if (!registered) return null;

  return {
    tenant: registered.tenant,
    linked: false,
  };
}

export async function registerEmployeeTenantLink(input: {
  externalUserId: string;
  channel: string;
  companyCode: string;
  displayName?: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createSupabaseServiceClient();
  const normalizedCode = input.companyCode.trim().toUpperCase();
  const { data: companyCode } = await supabase
    .from("tenant_company_codes")
    .select("id, tenant_id, tenants(*)")
    .eq("code", normalizedCode)
    .eq("status", "active")
    .maybeSingle();

  if (!companyCode?.tenant_id) {
    return null;
  }

  const tenant = Array.isArray(companyCode.tenants) ? companyCode.tenants[0] : companyCode.tenants;
  const { data: link, error } = await supabase.from("employee_tenant_links").upsert(
    {
      tenant_id: companyCode.tenant_id,
      external_user_id: input.externalUserId,
      channel: input.channel,
      company_code_id: companyCode.id,
      metadata: {
        ...(input.metadata ?? {}),
        display_name: input.displayName ?? null,
        linked_by: "company_code",
      },
    },
    { onConflict: "external_user_id,channel" },
  ).select("*").single();

  if (error) throw error;

  return {
    link,
    tenant,
    companyCode,
  };
}

export function centralBotNeedsCompanyCodeResponse() {
  return {
    success: true as const,
    reply: "กรุณาลงทะเบียนด้วยรหัสบริษัทก่อนใช้งานครับ เพื่อให้ผมผูกบัญชี LINE ของคุณกับบริษัทที่ถูกต้อง",
    message_type: "out_of_scope" as const,
    safety_level: "normal" as const,
    conversation_id: "",
    sources: [],
    handoff_required: false,
    handoff: { enabled: false, url: null, button_text: null, message: null },
    quota: { plan: "trial" as const, used: 0, limit: 0, remaining: 0 },
  };
}

export type ResolvedCentralTenant = Awaited<ReturnType<typeof resolveTenantForCentralBot>> & {
  tenant?: Tenant;
};
