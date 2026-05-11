import { NextRequest, NextResponse } from "next/server";
import { getTenantForAdmin, requireAdminUser } from "@/lib/auth/admin";
import { getWorkflowTokenTenantId, revokeWorkflowToken } from "@/lib/services/workflowTokenService";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) return admin.response;

    const { id } = await params;
    const tokenTenantId = await getWorkflowTokenTenantId(id);
    if (!tokenTenantId) {
      return NextResponse.json({ error: "Workflow token not found." }, { status: 404 });
    }

    const allowed =
      admin.appUser.role === "platform_admin" ? true : (await getTenantForAdmin()) === tokenTenantId;
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    await revokeWorkflowToken({ workflowTokenId: id, actorUserId: admin.appUser.id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("workflow_tokens_delete", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
