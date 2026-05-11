import { NextRequest, NextResponse } from "next/server";
import { getTenantForAdmin, requireAdminUser } from "@/lib/auth/admin";
import { createWorkflowToken, listWorkflowTokens } from "@/lib/services/workflowTokenService";
import { workflowTokenCreateSchema } from "@/lib/validation/admin";

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) return admin.response;

    const tenantId = request.nextUrl.searchParams.get("tenant_id");
    if (!tenantId) {
      return NextResponse.json({ error: "tenant_id query parameter is required." }, { status: 400 });
    }

    const allowed =
      admin.appUser.role === "platform_admin" ? true : (await getTenantForAdmin()) === tenantId;
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const tokens = await listWorkflowTokens(tenantId);
    return NextResponse.json({ tokens });
  } catch (error) {
    console.error("workflow_tokens_get", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) return admin.response;

    let jsonBody: unknown;
    try {
      jsonBody = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = workflowTokenCreateSchema.safeParse(jsonBody);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

    const allowed =
      admin.appUser.role === "platform_admin" ? true : (await getTenantForAdmin()) === parsed.data.tenant_id;
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const token = await createWorkflowToken({
      tenantId: parsed.data.tenant_id,
      name: parsed.data.name,
      createdBy: admin.appUser.id,
    });
    return NextResponse.json(token);
  } catch (error) {
    console.error("workflow_tokens_post", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
