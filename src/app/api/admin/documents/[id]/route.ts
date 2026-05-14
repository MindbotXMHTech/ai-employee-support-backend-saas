import { NextRequest, NextResponse } from "next/server";
import { canManageTenantScopedResource } from "@/lib/auth/tenantScopedAccess";
import { requireAdminUser } from "@/lib/auth/admin";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin.ok) return admin.response;

  const { id } = await params;
  const supabase = createSupabaseServiceClient();
  const { data: document, error } = await supabase
    .from("documents")
    .select("id, tenant_id, storage_path")
    .eq("id", id)
    .single();
  if (error || !document) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  const canManage = await canManageTenantScopedResource({ tenantId: document.tenant_id, appUser: admin.appUser });
  if (!canManage) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  if (document.storage_path) {
    await supabase.storage.from("tenant-documents").remove([document.storage_path]);
  }
  await supabase.from("documents").delete().eq("id", id);
  await supabase.from("audit_logs").insert({
    tenant_id: document.tenant_id,
    actor_user_id: admin.appUser.id,
    action: "document.deleted",
    target_type: "document",
    target_id: document.id,
  });
  return NextResponse.json({ ok: true });
}
