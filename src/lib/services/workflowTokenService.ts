import crypto from "node:crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import type { Tenant } from "@/lib/types";
import { registerEmployeeTenantLink, TenantConflictError } from "@/lib/services/centralBotService";

const WORKFLOW_TOKEN_PREFIX = "wf_live_";

/** Domain-separated from api_keys hashing. */
export function hashWorkflowToken(rawKey: string) {
  const secret = env.API_KEY_SECRET ?? "development-api-key-secret";
  return crypto.createHmac("sha256", secret).update(`workflow_token:v1|${rawKey}`).digest("hex");
}

export function generateRawWorkflowToken() {
  return `${WORKFLOW_TOKEN_PREFIX}${crypto.randomBytes(24).toString("base64url")}`;
}

export function getWorkflowTokenPrefix(rawKey: string) {
  const parts = rawKey.split("_");
  return parts.length >= 2 ? `${parts[0]}_${parts[1]}_${rawKey.slice(-6)}` : rawKey.slice(0, 12);
}

export async function listWorkflowTokens(tenantId: string) {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("workflow_tokens")
    .select("id, name, token_prefix, status, last_used_at, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getWorkflowTokenTenantId(workflowTokenId: string) {
  const supabase = createSupabaseServiceClient();
  const { data } = await supabase.from("workflow_tokens").select("tenant_id").eq("id", workflowTokenId).maybeSingle();
  return data?.tenant_id as string | undefined;
}

export async function createWorkflowToken(input: { tenantId: string; name: string; createdBy?: string | null }) {
  const supabase = createSupabaseServiceClient();
  const rawKey = generateRawWorkflowToken();
  const { data, error } = await supabase
    .from("workflow_tokens")
    .insert({
      tenant_id: input.tenantId,
      name: input.name,
      token_hash: hashWorkflowToken(rawKey),
      token_prefix: getWorkflowTokenPrefix(rawKey),
      created_by: input.createdBy ?? null,
    })
    .select("id, token_prefix, created_at")
    .single();

  if (error) throw error;
  await supabase.from("audit_logs").insert({
    tenant_id: input.tenantId,
    actor_user_id: input.createdBy ?? null,
    action: "workflow_token.created",
    target_type: "workflow_token",
    target_id: data.id,
    metadata: { token_prefix: data.token_prefix },
  });

  return { ...data, rawToken: rawKey };
}

export async function validateWorkflowToken(rawKey: string) {
  const supabase = createSupabaseServiceClient();
  const tokenHash = hashWorkflowToken(rawKey);
  const { data, error } = await supabase
    .from("workflow_tokens")
    .select("id, tenant_id, token_prefix, status, tenants(*)")
    .eq("token_hash", tokenHash)
    .eq("status", "active")
    .single();

  if (error || !data) return null;

  await supabase
    .from("workflow_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return {
    workflowTokenId: data.id as string,
    tenantId: data.tenant_id as string,
    tenant: (Array.isArray(data.tenants) ? data.tenants[0] : data.tenants) as Tenant,
  };
}

export async function revokeWorkflowToken(input: { workflowTokenId: string; actorUserId?: string | null }) {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("workflow_tokens")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("id", input.workflowTokenId)
    .select("id, tenant_id")
    .single();
  if (error) throw error;

  await supabase.from("audit_logs").insert({
    tenant_id: data.tenant_id,
    actor_user_id: input.actorUserId ?? null,
    action: "workflow_token.revoked",
    target_type: "workflow_token",
    target_id: data.id,
  });
}

export type WorkflowTenantResolution =
  | { ok: true; tenant: Tenant }
  | { ok: false; kind: "needs_company_code" }
  | { ok: false; kind: "tenant_mismatch" }
  | { ok: false; kind: "invalid_company_code" };

/**
 * Resolves tenant for workflow chat: token pins tenant; existing employee link must match;
 * new links require company_code that belongs to the token's tenant.
 */
export async function resolveTenantForWorkflowChat(input: {
  tokenTenant: Tenant;
  externalUserId: string;
  channel: string;
  companyCode?: string;
}): Promise<WorkflowTenantResolution> {
  const supabase = createSupabaseServiceClient();
  const tokenTenantId = input.tokenTenant.id;

  const { data: existingLink } = await supabase
    .from("employee_tenant_links")
    .select("tenant_id")
    .eq("external_user_id", input.externalUserId)
    .eq("channel", input.channel)
    .maybeSingle();

  if (existingLink?.tenant_id) {
    if (existingLink.tenant_id !== tokenTenantId) {
      return { ok: false, kind: "tenant_mismatch" };
    }
    return { ok: true, tenant: input.tokenTenant };
  }

  if (!input.companyCode?.trim()) {
    return { ok: false, kind: "needs_company_code" };
  }

  const normalizedCode = input.companyCode.trim().toUpperCase();
  const { data: codeRow } = await supabase
    .from("tenant_company_codes")
    .select("id")
    .eq("code", normalizedCode)
    .eq("tenant_id", tokenTenantId)
    .eq("status", "active")
    .maybeSingle();

  if (!codeRow?.id) {
    return { ok: false, kind: "invalid_company_code" };
  }

  try {
    const registered = await registerEmployeeTenantLink({
      externalUserId: input.externalUserId,
      channel: input.channel,
      companyCode: input.companyCode,
    });

    if (!registered?.tenant) {
      return { ok: false, kind: "invalid_company_code" };
    }

    return { ok: true, tenant: registered.tenant };
  } catch (error) {
    if (error instanceof TenantConflictError) {
      return { ok: false, kind: "tenant_mismatch" };
    }
    throw error;
  }
}
