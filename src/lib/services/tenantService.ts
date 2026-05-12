import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import type { Tenant } from "@/lib/types";
import crypto from "node:crypto";
import { ensureCompanyCodeForTenant } from "@/lib/services/companyCodeService";
import { pushMindbloomCompanyProvision } from "@/lib/services/mindbloomProvisionService";
import { getPlatformAiSettings } from "@/lib/services/platformAiSettingsService";

export function planDefaults(plan: "trial" | "pro") {
  if (plan === "pro") {
    return {
      monthly_message_limit: env.DEFAULT_PRO_MESSAGE_LIMIT,
      storage_limit_mb: 1024,
      max_files: 100,
      max_bots: 3,
    };
  }

  return {
    monthly_message_limit: env.DEFAULT_TRIAL_MESSAGE_LIMIT,
    storage_limit_mb: 50,
    max_files: 10,
    max_bots: 1,
  };
}

export async function getTenant(tenantId: string) {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.from("tenants").select("*").eq("id", tenantId).single();
  if (error) throw error;
  return data as Tenant;
}

export async function enforceTenantAvailability(tenant: Tenant) {
  const supabase = createSupabaseServiceClient();

  if (tenant.status === "suspended") {
    return { ok: false as const, code: "TENANT_SUSPENDED" as const, message: "Tenant is suspended." };
  }

  if (tenant.plan === "trial" && tenant.trial_ends_at && new Date(tenant.trial_ends_at) < new Date()) {
    await supabase.from("tenants").update({ status: "expired" }).eq("id", tenant.id);
    return { ok: false as const, code: "TRIAL_EXPIRED" as const, message: "Trial has expired." };
  }

  if (tenant.status === "expired") {
    return { ok: false as const, code: "TRIAL_EXPIRED" as const, message: "Tenant plan has expired." };
  }

  return { ok: true as const };
}

export async function createTenant(input: { name: string; slug: string; plan: "trial" | "pro" }) {
  const supabase = createSupabaseServiceClient();
  const now = new Date();
  const trialEndsAt = new Date(now);
  trialEndsAt.setDate(trialEndsAt.getDate() + env.DEFAULT_TRIAL_DAYS);
  const defaults = planDefaults(input.plan);

  const { data, error } = await supabase
    .from("tenants")
    .insert({
      name: input.name,
      slug: input.slug,
      plan: input.plan,
      status: "active",
      trial_started_at: input.plan === "trial" ? now.toISOString() : null,
      trial_ends_at: input.plan === "trial" ? trialEndsAt.toISOString() : null,
      ...defaults,
    })
    .select("*")
    .single();

  if (error) throw error;
  await supabase.from("tenant_profiles").insert({ tenant_id: data.id, company_name: input.name });
  const aiDefaults = await getPlatformAiSettings();
  await supabase.from("bot_settings").insert({
    tenant_id: data.id,
    name: aiDefaults.name,
    tone: aiDefaults.tone,
    default_language: aiDefaults.default_language,
    max_sentences: aiDefaults.max_sentences,
    rag_enabled: aiDefaults.rag_enabled,
    mental_health_enabled: aiDefaults.mental_health_enabled,
    safety_enabled: aiDefaults.safety_enabled,
    handoff_enabled: aiDefaults.handoff_enabled,
    is_active: true,
    general_model: aiDefaults.general_model,
    rag_model: aiDefaults.rag_model,
    safety_model: aiDefaults.safety_model,
    embedding_model: aiDefaults.embedding_model,
    classification_enabled: aiDefaults.classification_enabled,
    system_instruction: aiDefaults.system_instruction,
  });
  await supabase.from("escalation_settings").insert({ tenant_id: data.id });
  return data as Tenant;
}

export function slugifyTenantName(name: string) {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `tenant-${crypto.randomBytes(3).toString("hex")}`;
}

async function generateUniqueTenantSlug(baseName: string) {
  const supabase = createSupabaseServiceClient();
  const baseSlug = slugifyTenantName(baseName);
  let slug = baseSlug;
  let suffix = 2;

  while (true) {
    const { data } = await supabase.from("tenants").select("id").eq("slug", slug).maybeSingle();
    if (!data) return slug;
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

export async function createTenantOnboarding(input: {
  name: string;
  plan: "trial" | "pro";
  industry?: string;
  company_description?: string;
  hr_contact_name?: string;
  hr_contact_email?: string;
  admin_email: string;
  admin_display_name: string;
  created_by?: string | null;
}) {
  const supabase = createSupabaseServiceClient();
  const slug = await generateUniqueTenantSlug(input.name);
  const tenant = await createTenant({ name: input.name, slug, plan: input.plan });
  const temporaryPassword = crypto.randomBytes(12).toString("base64url");

  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: input.admin_email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: {
      display_name: input.admin_display_name,
    },
  });
  if (authError) throw authError;

  const { data: appUser, error: userError } = await supabase
    .from("users")
    .insert({
      auth_user_id: authUser.user.id,
      email: input.admin_email,
      display_name: input.admin_display_name,
      role: "tenant_admin",
    })
    .select("id, email, display_name")
    .single();
  if (userError) throw userError;

  const [{ error: memberError }, { error: profileError }] = await Promise.all([
    supabase.from("tenant_members").insert({
      tenant_id: tenant.id,
      user_id: appUser.id,
      role: "tenant_admin",
      status: "active",
    }),
    supabase
      .from("tenant_profiles")
      .update({
        company_name: input.name,
        industry: input.industry || null,
        company_description: input.company_description || null,
        hr_contact_name: input.hr_contact_name || null,
        hr_contact_email: input.hr_contact_email || null,
      })
      .eq("tenant_id", tenant.id),
  ]);
  if (memberError) throw memberError;
  if (profileError) throw profileError;

  const companyCode = await ensureCompanyCodeForTenant({
    tenantId: tenant.id,
    tenantName: tenant.name,
    createdBy: input.created_by,
  });

  await supabase.from("audit_logs").insert({
    tenant_id: tenant.id,
    action: "tenant.onboarded",
    target_type: "tenant",
    target_id: tenant.id,
    metadata: {
      admin_email: input.admin_email,
      slug,
      plan: input.plan,
    },
  });

  void pushMindbloomCompanyProvision({
    company_code: companyCode.code,
    tenant_id: tenant.id,
    tenant_name: tenant.name,
  }).catch((error) => {
    console.error("mindbloom_provision_unhandled", { tenant_id: tenant.id, error });
  });

  return {
    tenant,
    adminUser: appUser,
    companyCode,
    temporaryPassword,
  };
}

export async function deleteTenantById(input: { tenantId: string; actorUserId?: string | null }) {
  const supabase = createSupabaseServiceClient();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, slug")
    .eq("id", input.tenantId)
    .maybeSingle();
  if (!tenant) return { ok: false as const, code: "NOT_FOUND" as const };

  const { data: members } = await supabase
    .from("tenant_members")
    .select("user_id, users(auth_user_id, role)")
    .eq("tenant_id", input.tenantId);

  const { data: documents } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("tenant_id", input.tenantId);

  await supabase.from("audit_logs").insert({
    tenant_id: null,
    actor_user_id: input.actorUserId ?? null,
    action: "tenant.deleted",
    target_type: "tenant",
    target_id: input.tenantId,
    metadata: { name: tenant.name, slug: tenant.slug },
  });

  const storagePaths = (documents ?? [])
    .map((doc) => doc.storage_path)
    .filter((path): path is string => Boolean(path));
  if (storagePaths.length) {
    await supabase.storage.from("tenant-documents").remove(storagePaths);
  }

  const { error: deleteError } = await supabase.from("tenants").delete().eq("id", input.tenantId);
  if (deleteError) throw deleteError;

  for (const member of members ?? []) {
    const userId = member.user_id as string;
    const userRecord = Array.isArray(member.users) ? member.users[0] : member.users;
    const authUserId = userRecord?.auth_user_id as string | undefined;
    if (!authUserId) continue;

    const { count } = await supabase
      .from("tenant_members")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    if ((count ?? 0) === 0) {
      await supabase.auth.admin.deleteUser(authUserId);
    }
  }

  return { ok: true as const, tenant };
}
