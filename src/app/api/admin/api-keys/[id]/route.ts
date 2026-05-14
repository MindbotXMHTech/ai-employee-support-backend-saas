import { NextRequest, NextResponse } from "next/server";
import { canManageTenantScopedResource } from "@/lib/auth/tenantScopedAccess";
import { requireAdminUser } from "@/lib/auth/admin";
import { getApiKeyTenantId, revokeApiKey } from "@/lib/services/apiKeyService";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin.ok) return admin.response;

  const { id } = await params;
  const tenantId = await getApiKeyTenantId(id);
  if (!tenantId) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const allowed = await canManageTenantScopedResource({ tenantId, appUser: admin.appUser });
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  await revokeApiKey({ apiKeyId: id, actorUserId: admin.appUser.id });
  return NextResponse.json({ ok: true });
}
