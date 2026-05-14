import {
  createSupabaseServiceClient,
  hasSupabaseConfig,
} from "@/lib/supabase/server";
import {
  currentMonthStart,
  getQuotaSnapshot,
} from "@/lib/services/quotaService";
import { usageSummary } from "@/lib/services/usageService";

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  plan: "free" | "trial" | "pro";
  status: "active" | "suspended" | "expired";
  monthly_message_limit: number;
  trial_ends_at: string | null;
  created_at: string;
}

interface TenantWithMetrics extends TenantRow {
  companyCode: string | null;
  messagesUsed: number;
  estimatedCostUsd: number;
  documentsCount: number;
  lastActivityAt: string | null;
}

export async function platformOverview() {
  if (!hasSupabaseConfig()) return null;
  const supabase = createSupabaseServiceClient();
  const [
    { count: totalTenants },
    { count: activeTenants },
    { count: trialTenants },
    { count: proTenants },
    { data: usage },
    tenantsWithMetrics,
  ] = await Promise.all([
    supabase.from("tenants").select("id", { count: "exact", head: true }),
    supabase
      .from("tenants")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("tenants")
      .select("id", { count: "exact", head: true })
      .eq("plan", "trial"),
    supabase
      .from("tenants")
      .select("id", { count: "exact", head: true })
      .eq("plan", "pro"),
    supabase
      .from("usage_logs")
      .select("tenant_id, estimated_cost_usd")
      .gte("created_at", currentMonthStart()),
    listTenantsWithMetrics(),
  ]);

  const totalCost = (usage ?? []).reduce(
    (sum, row) => sum + Number(row.estimated_cost_usd ?? 0),
    0,
  );
  const topTenants = tenantsWithMetrics
    .slice()
    .sort((a, b) => b.messagesUsed - a.messagesUsed)
    .slice(0, 5);

  return {
    totalTenants,
    activeTenants,
    trialTenants,
    proTenants,
    totalCost,
    topTenants,
  };
}

export async function listTenants() {
  if (!hasSupabaseConfig()) return [];
  const supabase = createSupabaseServiceClient();
  const { data } = await supabase
    .from("tenants")
    .select("*")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function listTenantsWithMetrics(): Promise<TenantWithMetrics[]> {
  if (!hasSupabaseConfig()) return [];
  const supabase = createSupabaseServiceClient();
  const [
    { data: tenants },
    { data: messages },
    { data: usage },
    { data: documents },
    { data: companyCodes },
  ] = await Promise.all([
    supabase
      .from("tenants")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("messages")
      .select("tenant_id, created_at")
      .eq("role", "assistant")
      .gte("created_at", currentMonthStart()),
    supabase
      .from("usage_logs")
      .select("tenant_id, estimated_cost_usd")
      .gte("created_at", currentMonthStart()),
    supabase.from("documents").select("tenant_id"),
    supabase
      .from("tenant_company_codes")
      .select("tenant_id, code")
      .eq("status", "active"),
  ]);

  return ((tenants ?? []) as TenantRow[]).map((tenant) => {
    const tenantMessages = (messages ?? []).filter(
      (message) => message.tenant_id === tenant.id,
    );
    const companyCode =
      (companyCodes ?? []).find((code) => code.tenant_id === tenant.id)?.code ??
      null;
    return {
      ...tenant,
      companyCode,
      messagesUsed: tenantMessages.length,
      estimatedCostUsd: (usage ?? [])
        .filter((row) => row.tenant_id === tenant.id)
        .reduce((sum, row) => sum + Number(row.estimated_cost_usd ?? 0), 0),
      documentsCount: (documents ?? []).filter(
        (document) => document.tenant_id === tenant.id,
      ).length,
      lastActivityAt:
        tenantMessages
          .map((message) => message.created_at as string)
          .sort((a, b) => b.localeCompare(a))[0] ?? null,
    };
  });
}

export async function tenantManagementData(tenantId: string) {
  if (!hasSupabaseConfig()) return null;
  const supabase = createSupabaseServiceClient();
  const [
    { data: tenant },
    { data: profile },
    { data: apiKeys },
    { data: workflowTokens },
    { data: documents },
    { data: conversations },
    { data: escalation },
    { count: employeeLinksCount },
  ] = await Promise.all([
    supabase.from("tenants").select("*").eq("id", tenantId).single(),
    supabase
      .from("tenant_profiles")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    supabase
      .from("api_keys")
      .select("id, name, key_prefix, status, last_used_at, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
    supabase
      .from("workflow_tokens")
      .select("id, name, token_prefix, status, last_used_at, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
    supabase
      .from("documents")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
    supabase
      .from("conversations")
      .select("*, messages(*)")
      .eq("tenant_id", tenantId)
      .order("updated_at", { ascending: false })
      .limit(20),
    supabase
      .from("escalation_settings")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    supabase
      .from("employee_tenant_links")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
  ]);

  if (!tenant) return null;
  const [quota, usage] = await Promise.all([
    getQuotaSnapshot(tenant),
    usageSummary(tenantId, currentMonthStart()),
  ]);
  return {
    tenant,
    profile,
    apiKeys: apiKeys ?? [],
    workflowTokens: workflowTokens ?? [],
    documents: documents ?? [],
    conversations: conversations ?? [],
    escalation,
    employeeLinksCount,
    quota,
    usage,
  };
}

export async function tenantDashboardData(tenantId?: string | null) {
  if (!hasSupabaseConfig() || !tenantId) return null;
  const supabase = createSupabaseServiceClient();
  const [
    { data: tenant },
    { count: documentsCount },
    { count: readyDocuments },
    { count: safetyAlerts },
    { data: conversations },
  ] = await Promise.all([
    supabase.from("tenants").select("*").eq("id", tenantId).single(),
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "ready"),
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .in("safety_level", ["high", "crisis"]),
    supabase
      .from("conversations")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("updated_at", { ascending: false })
      .limit(5),
  ]);

  if (!tenant) return null;
  const [quota, usage] = await Promise.all([
    getQuotaSnapshot(tenant),
    usageSummary(tenantId, currentMonthStart()),
  ]);
  return {
    tenant,
    quota,
    usage,
    documentsCount,
    readyDocuments,
    safetyAlerts,
    conversations: conversations ?? [],
  };
}

export async function tenantTables(tenantId?: string | null) {
  if (!hasSupabaseConfig() || !tenantId) return null;
  const supabase = createSupabaseServiceClient();
  const [profile, documents, apiKeys, conversations, escalation] =
    await Promise.all([
      supabase
        .from("tenant_profiles")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle(),
      supabase
        .from("documents")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false }),
      supabase
        .from("api_keys")
        .select("id, name, key_prefix, status, last_used_at, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false }),
      supabase
        .from("conversations")
        .select("*, messages(*)")
        .eq("tenant_id", tenantId)
        .order("updated_at", { ascending: false })
        .limit(20),
      supabase
        .from("escalation_settings")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle(),
    ]);
  return {
    profile: profile.data,
    documents: documents.data ?? [],
    apiKeys: apiKeys.data ?? [],
    conversations: conversations.data ?? [],
    escalation: escalation.data,
  };
}
