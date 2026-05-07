import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth/admin";
import { runRagPlayground } from "@/lib/services/playgroundService";
import { playgroundRequestSchema } from "@/lib/validation/chat";

export async function POST(request: NextRequest) {
  const admin = await requireAdminUser();
  if (!admin.ok) return admin.response;

  const parsed = playgroundRequestSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const result = await runRagPlayground({
    tenantId: parsed.data.tenant_id,
    message: parsed.data.message,
    botId: parsed.data.bot_id,
  });
  return NextResponse.json(result);
}
