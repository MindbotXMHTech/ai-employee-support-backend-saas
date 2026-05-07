import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { QuotaSnapshot, Tenant } from "@/lib/types";

export function currentMonthStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export async function getQuotaSnapshot(tenant: Tenant): Promise<QuotaSnapshot> {
  const supabase = createSupabaseServiceClient();
  const fromDate = tenant.plan === "pro" ? currentMonthStart() : tenant.trial_started_at ?? tenant.created_at;

  const { count, error } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenant.id)
    .eq("role", "assistant")
    .neq("message_type", "quota_exceeded")
    .gte("created_at", fromDate);

  if (error) throw error;
  const used = count ?? 0;
  const limit = tenant.monthly_message_limit;
  return { plan: tenant.plan, used, limit, remaining: Math.max(limit - used, 0) };
}

export async function checkQuota(tenant: Tenant) {
  const quota = await getQuotaSnapshot(tenant);
  return {
    ok: quota.remaining > 0,
    quota,
  };
}
