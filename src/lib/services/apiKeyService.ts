import crypto from "node:crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

const API_KEY_PREFIX = "aibot_live";

export function hashApiKey(rawKey: string) {
  const secret = env.API_KEY_SECRET ?? "development-api-key-secret";
  return crypto.createHmac("sha256", secret).update(rawKey).digest("hex");
}

export function generateRawApiKey() {
  return `${API_KEY_PREFIX}_${crypto.randomBytes(24).toString("base64url")}`;
}

export function getApiKeyPrefix(rawKey: string) {
  const parts = rawKey.split("_");
  return parts.length >= 3 ? `${parts[0]}_${parts[1]}_${rawKey.slice(-6)}` : rawKey.slice(0, 12);
}

export async function getApiKeyTenantId(apiKeyId: string): Promise<string | null> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.from("api_keys").select("tenant_id").eq("id", apiKeyId).maybeSingle();
  if (error) throw error;
  return (data?.tenant_id as string | undefined) ?? null;
}

export async function createApiKey(input: { tenantId: string; name: string; createdBy?: string | null }) {
  const supabase = createSupabaseServiceClient();
  const rawKey = generateRawApiKey();
  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      tenant_id: input.tenantId,
      name: input.name,
      key_hash: hashApiKey(rawKey),
      key_prefix: getApiKeyPrefix(rawKey),
      created_by: input.createdBy ?? null,
    })
    .select("id, key_prefix, created_at")
    .single();

  if (error) throw error;
  await supabase.from("audit_logs").insert({
    tenant_id: input.tenantId,
    actor_user_id: input.createdBy ?? null,
    action: "api_key.created",
    target_type: "api_key",
    target_id: data.id,
    metadata: { key_prefix: data.key_prefix },
  });

  return { ...data, rawKey };
}

export async function validateApiKey(rawKey: string) {
  const supabase = createSupabaseServiceClient();
  const keyHash = hashApiKey(rawKey);
  const { data, error } = await supabase
    .from("api_keys")
    .select("id, tenant_id, key_prefix, status, tenants(*)")
    .eq("key_hash", keyHash)
    .eq("status", "active")
    .single();

  if (error || !data) return null;

  await supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);

  return {
    apiKeyId: data.id as string,
    tenantId: data.tenant_id as string,
    tenant: Array.isArray(data.tenants) ? data.tenants[0] : data.tenants,
  };
}

export async function revokeApiKey(input: { apiKeyId: string; actorUserId?: string | null }) {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("api_keys")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("id", input.apiKeyId)
    .select("id, tenant_id")
    .single();
  if (error) throw error;

  await supabase.from("audit_logs").insert({
    tenant_id: data.tenant_id,
    actor_user_id: input.actorUserId ?? null,
    action: "api_key.revoked",
    target_type: "api_key",
    target_id: data.id,
  });
}
