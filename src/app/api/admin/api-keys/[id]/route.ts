import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth/admin";
import { revokeApiKey } from "@/lib/services/apiKeyService";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin.ok) return admin.response;

  const { id } = await params;
  await revokeApiKey({ apiKeyId: id, actorUserId: admin.appUser.id });
  return NextResponse.json({ ok: true });
}
