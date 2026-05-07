import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth/admin";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { createDocumentRecord, processDocument, uploadDocumentFile, validateDocumentFile } from "@/lib/services/documentService";
import { documentUploadSchema } from "@/lib/validation/admin";
import type { DocumentCategory } from "@/lib/types";

async function canManageTenantDocuments(input: { tenantId: string; appUser: { id: string; role: string } }) {
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

export async function POST(request: NextRequest) {
  const admin = await requireAdminUser();
  if (!admin.ok) return admin.response;

  const formData = await request.formData();
  const file = formData.get("file");
  const parsed = documentUploadSchema.safeParse({
    tenant_id: formData.get("tenant_id"),
    document_category: formData.get("document_category"),
  });

  if (!parsed.success || !(file instanceof File)) {
    return NextResponse.json({ error: "Invalid upload payload." }, { status: 400 });
  }

  const canManage = await canManageTenantDocuments({ tenantId: parsed.data.tenant_id, appUser: admin.appUser });
  if (!canManage) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const supabase = createSupabaseServiceClient();
  const [{ data: tenant }, { count }, { data: documents }] = await Promise.all([
    supabase.from("tenants").select("*").eq("id", parsed.data.tenant_id).single(),
    supabase.from("documents").select("id", { count: "exact", head: true }).eq("tenant_id", parsed.data.tenant_id),
    supabase.from("documents").select("file_size_bytes").eq("tenant_id", parsed.data.tenant_id),
  ]);

  const usedBytes = (documents ?? []).reduce((sum, row) => sum + Number(row.file_size_bytes ?? 0), 0);
  if ((count ?? 0) >= Number(tenant.max_files)) {
    return NextResponse.json({ error: "Tenant file limit exceeded." }, { status: 400 });
  }
  validateDocumentFile(file, { maxBytes: Number(tenant.storage_limit_mb) * 1024 * 1024 - usedBytes });

  const document = await createDocumentRecord({
    tenantId: parsed.data.tenant_id,
    uploadedBy: admin.appUser.id,
    file,
    category: parsed.data.document_category as DocumentCategory,
  });
  await uploadDocumentFile({ tenantId: parsed.data.tenant_id, documentId: document.id, file });
  const result = await processDocument({ tenantId: parsed.data.tenant_id, documentId: document.id, file });

  return NextResponse.json({ document, processing: result });
}
