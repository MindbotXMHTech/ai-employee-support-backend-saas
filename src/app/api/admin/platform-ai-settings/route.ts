import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth/admin";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getPlatformAiSettings } from "@/lib/services/platformAiSettingsService";
import { platformAiSettingsSchema } from "@/lib/validation/admin";

export async function PATCH(request: NextRequest) {
  const admin = await requireAdminUser();
  if (!admin.ok) return admin.response;
  if (admin.appUser.role !== "platform_admin") {
    return NextResponse.json({ error: "Platform admin required." }, { status: 403 });
  }

  const parsed = platformAiSettingsSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const supabase = createSupabaseServiceClient();
  const current = await getPlatformAiSettings();
  const payload = {
    ...parsed.data,
    system_instruction: parsed.data.system_instruction || null,
  };

  const query = current.id
    ? supabase.from("platform_bot_settings").update(payload).eq("id", current.id)
    : supabase.from("platform_bot_settings").insert(payload);

  const { data, error } = await query.select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabase.from("audit_logs").insert({
    tenant_id: null,
    actor_user_id: admin.appUser.id,
    action: "platform_ai_settings.updated",
    target_type: "platform_bot_settings",
    target_id: data.id,
    metadata: payload,
  });

  return NextResponse.json(data);
}
