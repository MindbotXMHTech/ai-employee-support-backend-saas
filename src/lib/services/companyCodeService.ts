import crypto from "node:crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export class CompanyCodeTakenError extends Error {
  readonly code = "COMPANY_CODE_TAKEN";

  constructor() {
    super("Company code is already in use.");
    this.name = "CompanyCodeTakenError";
  }
}

export function generateCompanyCode(name: string) {
  const prefix = name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4)
    .padEnd(3, "X");
  return `${prefix}${crypto.randomInt(100, 999)}`;
}

export async function createCompanyCodeForTenant(input: {
  tenantId: string;
  tenantName: string;
  createdBy?: string | null;
}) {
  const supabase = createSupabaseServiceClient();
  let code = generateCompanyCode(input.tenantName);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data } = await supabase.from("tenant_company_codes").select("id").eq("code", code).maybeSingle();
    if (!data) break;
    code = generateCompanyCode(input.tenantName);
  }

  const { data, error } = await supabase
    .from("tenant_company_codes")
    .insert({
      tenant_id: input.tenantId,
      code,
      created_by: input.createdBy ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function ensureCompanyCodeForTenant(input: {
  tenantId: string;
  tenantName: string;
  createdBy?: string | null;
}) {
  const supabase = createSupabaseServiceClient();
  const { data: existing } = await supabase
    .from("tenant_company_codes")
    .select("*")
    .eq("tenant_id", input.tenantId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing) return existing;
  return createCompanyCodeForTenant(input);
}

export async function isCompanyCodeTaken(normalizedCode: string): Promise<boolean> {
  const supabase = createSupabaseServiceClient();
  const { data } = await supabase.from("tenant_company_codes").select("id").eq("code", normalizedCode).maybeSingle();
  return Boolean(data);
}

/** Caller supplies code (partner provisioning). Unique constraint races map to CompanyCodeTakenError. */
export async function insertCompanyCodeForTenant(input: {
  tenantId: string;
  code: string;
  createdBy?: string | null;
}) {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("tenant_company_codes")
    .insert({
      tenant_id: input.tenantId,
      code: input.code,
      created_by: input.createdBy ?? null,
    })
    .select("*")
    .single();

  if (error) {
    const pgCode =
      typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
        ? error.code
        : "";
    const msg =
      typeof error === "object" && error !== null && "message" in error ? String((error as { message?: string }).message) : "";
    if (pgCode === "23505" || msg.toLowerCase().includes("duplicate"))
      throw new CompanyCodeTakenError();
    throw error;
  }

  return data;
}
