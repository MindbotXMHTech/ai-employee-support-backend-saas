import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth/admin";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { deleteTenantById } from "@/lib/services/tenantService";
import { tenantUpdateSchema } from "@/lib/validation/admin";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin.ok) return admin.response;
  if (admin.appUser.role !== "platform_admin") {
    return NextResponse.json({ error: "Platform admin required." }, { status: 403 });
  }

  const { id } = await params;
  try {
    const result = await deleteTenantById({ tenantId: id, actorUserId: admin.appUser.id });
    if (!result.ok) {
      return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
    }
    return NextResponse.json({ success: true, tenant: result.tenant });
  } catch (error) {
    console.error("delete_tenant_error", error);
    const message = error instanceof Error ? error.message : "Failed to delete tenant.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin.ok) return admin.response;
  if (admin.appUser.role !== "platform_admin") {
    return NextResponse.json({ error: "Platform admin required." }, { status: 403 });
  }

  const { id } = await params;
  const parsed = tenantUpdateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("tenants")
    .update(parsed.data)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabase.from("audit_logs").insert({
    tenant_id: id,
    actor_user_id: admin.appUser.id,
    action: "tenant.updated",
    target_type: "tenant",
    target_id: id,
    metadata: parsed.data,
  });

  return NextResponse.json(data);
}
