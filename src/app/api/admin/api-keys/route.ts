import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth/admin";
import { createApiKey } from "@/lib/services/apiKeyService";
import { apiKeyCreateSchema } from "@/lib/validation/admin";

export async function POST(request: NextRequest) {
  const admin = await requireAdminUser();
  if (!admin.ok) return admin.response;

  const parsed = apiKeyCreateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const apiKey = await createApiKey({
    tenantId: parsed.data.tenant_id,
    name: parsed.data.name,
    createdBy: admin.appUser.id,
  });
  return NextResponse.json(apiKey);
}
