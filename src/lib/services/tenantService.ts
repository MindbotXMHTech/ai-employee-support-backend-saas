import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import type { Tenant } from "@/lib/types";
import crypto from "node:crypto";
import {
  ensureCompanyCodeForTenant,
  insertCompanyCodeForTenant,
  isCompanyCodeTaken,
  CompanyCodeTakenError,
} from "@/lib/services/companyCodeService";
import { pushMindbloomCompanyProvision } from "@/lib/services/mindbloomProvisionService";
import { getPlatformAiSettings } from "@/lib/services/platformAiSettingsService";

export function planDefaults(plan: "free" | "trial" | "pro") {
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
  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .eq("id", tenantId)
    .single();
  if (error) throw error;
  return data as Tenant;
}

async function pushTenantPlanMirror(tenant: Tenant) {
  const supabase = createSupabaseServiceClient();
  const { data: companyCode, error } = await supabase
    .from("tenant_company_codes")
    .select("code")
    .eq("tenant_id", tenant.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!companyCode?.code) return false;

  await pushMindbloomCompanyProvision({
    company_code: companyCode.code,
    tenant_id: tenant.id,
    tenant_name: tenant.name,
    plan: tenant.plan,
  });
  return true;
}

export async function downgradeTrialTenantToFree(input: {
  tenantId: string;
  actorUserId?: string | null;
  source?: string;
  now?: Date;
}) {
  const supabase = createSupabaseServiceClient();
  const now = input.now ?? new Date();
  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("*")
    .eq("id", input.tenantId)
    .maybeSingle();

  if (tenantError) throw tenantError;
  if (!tenant) return { ok: false as const, code: "NOT_FOUND" as const };
  if (tenant.plan !== "trial") {
    return {
      ok: false as const,
      code: "NOT_TRIAL" as const,
      tenant: tenant as Tenant,
    };
  }
  if (tenant.trial_ends_at && new Date(tenant.trial_ends_at) > now) {
    return {
      ok: false as const,
      code: "TRIAL_ACTIVE" as const,
      tenant: tenant as Tenant,
    };
  }

  const { data: updated, error: updateError } = await supabase
    .from("tenants")
    .update({ plan: "free", status: "expired" })
    .eq("id", input.tenantId)
    .eq("plan", "trial")
    .select("*")
    .single();

  if (updateError) throw updateError;
  const updatedTenant = updated as Tenant;

  await supabase.from("audit_logs").insert({
    tenant_id: updatedTenant.id,
    actor_user_id: input.actorUserId ?? null,
    action: "tenant.trial_downgraded_to_free",
    target_type: "tenant",
    target_id: updatedTenant.id,
    metadata: {
      source: input.source ?? "trial_expiry",
      previous_plan: "trial",
      new_plan: "free",
      trial_ends_at: tenant.trial_ends_at,
    },
  });

  const synced = await pushTenantPlanMirror(updatedTenant);
  return { ok: true as const, tenant: updatedTenant, synced };
}

export async function downgradeExpiredTrialTenantsToFree(
  input: {
    actorUserId?: string | null;
    source?: string;
    now?: Date;
  } = {},
) {
  const supabase = createSupabaseServiceClient();
  const now = input.now ?? new Date();
  const { data: tenants, error } = await supabase
    .from("tenants")
    .select("id")
    .eq("plan", "trial")
    .eq("status", "active")
    .not("trial_ends_at", "is", null)
    .lte("trial_ends_at", now.toISOString());

  if (error) throw error;

  const results = [];
  for (const tenant of tenants ?? []) {
    results.push(
      await downgradeTrialTenantToFree({
        tenantId: tenant.id as string,
        actorUserId: input.actorUserId,
        source: input.source ?? "scheduled_trial_expiry",
        now,
      }),
    );
  }

  return {
    checked: tenants?.length ?? 0,
    downgraded: results.filter((result) => result.ok).length,
    synced: results.filter((result) => result.ok && result.synced).length,
    results,
  };
}

export async function enforceTenantAvailability(tenant: Tenant) {
  if (tenant.status === "suspended") {
    return {
      ok: false as const,
      code: "TENANT_SUSPENDED" as const,
      message: "Tenant is suspended.",
    };
  }

  if (
    tenant.plan === "trial" &&
    tenant.trial_ends_at &&
    new Date(tenant.trial_ends_at) < new Date()
  ) {
    await downgradeTrialTenantToFree({
      tenantId: tenant.id,
      source: "chat_availability_check",
    });
    return { ok: true as const };
  }

  if (tenant.status === "expired" || tenant.plan === "free") {
    return {
      ok: false as const,
      code: "TRIAL_EXPIRED" as const,
      message: "Free plan is not available for chat.",
    };
  }

  return { ok: true as const };
}

export async function createTenant(input: {
  name: string;
  slug: string;
  plan: "free" | "trial" | "pro";
}) {
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
  await supabase
    .from("tenant_profiles")
    .insert({ tenant_id: data.id, company_name: input.name });
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
    const { data } = await supabase
      .from("tenants")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!data) return slug;
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

export async function createTenantOnboarding(input: {
  name: string;
  plan: "free" | "trial" | "pro";
  industry?: string;
  company_description?: string;
  hr_contact_name?: string;
  hr_contact_email?: string;
  admin_email: string;
  admin_display_name: string;
  created_by?: string | null;
  /** When set (e.g. partner API), persists this code instead of auto-generating. Must be globally unique (active codes). */
  company_code?: string;
}) {
  const supabase = createSupabaseServiceClient();

  if (input.company_code) {
    const taken = await isCompanyCodeTaken(input.company_code);
    if (taken) throw new CompanyCodeTakenError();
  }

  const slug = await generateUniqueTenantSlug(input.name);
  const tenant = await createTenant({
    name: input.name,
    slug,
    plan: input.plan,
  });
  const temporaryPassword = crypto.randomBytes(12).toString("base64url");

  const { data: authUser, error: authError } =
    await supabase.auth.admin.createUser({
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

  const companyCode = input.company_code
    ? await insertCompanyCodeForTenant({
        tenantId: tenant.id,
        code: input.company_code,
        createdBy: input.created_by,
      })
    : await ensureCompanyCodeForTenant({
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
      ...(input.company_code ? { partner_company_code: input.company_code } : {}),
    },
  });

  void pushMindbloomCompanyProvision({
    company_code: companyCode.code,
    tenant_id: tenant.id,
    tenant_name: tenant.name,
    plan: tenant.plan,
  }).catch((error) => {
    console.error("mindbloom_provision_unhandled", {
      tenant_id: tenant.id,
      error,
    });
  });

  return {
    tenant,
    adminUser: appUser,
    companyCode,
    temporaryPassword,
  };
}

export async function deleteTenantById(input: {
  tenantId: string;
  actorUserId?: string | null;
}) {
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

  const { error: deleteError } = await supabase
    .from("tenants")
    .delete()
    .eq("id", input.tenantId);
  if (deleteError) throw deleteError;

  for (const member of members ?? []) {
    const userId = member.user_id as string;
    const userRecord = Array.isArray(member.users)
      ? member.users[0]
      : member.users;
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
