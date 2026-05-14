import { createSupabaseServiceClient } from "@/lib/supabase/server";

/** Platform admins may manage any tenant; tenant admins only if active membership. */
export async function canManageTenantScopedResource(input: {
  tenantId: string;
  appUser: { id: string; role: string };
}): Promise<boolean> {
  if (input.appUser.role === "platform_admin") return true;

  const supabase = createSupabaseServiceClient();
  const { data } = await supabase
    .from("tenant_members")
    .select("id")
    .eq("tenant_id", input.tenantId)
    .eq("user_id", input.appUser.id)
    .eq("status", "active")
    .maybeSingle();

  return Boolean(data);
}
