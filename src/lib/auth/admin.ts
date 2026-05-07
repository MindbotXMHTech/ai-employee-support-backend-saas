import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getCurrentAppUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: appUser } = await supabase
    .from("users")
    .select("id, role, email, display_name")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!appUser) return null;
  return { authUser: user, appUser };
}

export async function requireAdminUser() {
  const currentUser = await getCurrentAppUser();

  if (!currentUser) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Authentication required." }, { status: 401 }),
    };
  }

  return { ok: true as const, authUser: currentUser.authUser, appUser: currentUser.appUser };
}

export async function getTenantForAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: appUser } = await supabase
    .from("users")
    .select("id, role, tenant_members(tenant_id)")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!appUser) return null;
  if (appUser.role === "platform_admin") return null;
  const memberships = appUser.tenant_members as { tenant_id: string }[] | null;
  return memberships?.[0]?.tenant_id ?? null;
}
