import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth/admin";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getTenantAiSettings } from "@/lib/services/platformAiSettingsService";
import { platformAiSettingsSchema } from "@/lib/validation/admin";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin.ok) return admin.response;
  if (admin.appUser.role !== "platform_admin") {
    return NextResponse.json({ error: "Platform admin required." }, { status: 403 });
  }

  const { id } = await params;
  const parsed = platformAiSettingsSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const supabase = createSupabaseServiceClient();
  const current = await getTenantAiSettings(id);
  const payload = {
    name: parsed.data.name,
    tone: parsed.data.tone,
    default_language: parsed.data.default_language,
    max_sentences: parsed.data.max_sentences,
    rag_enabled: parsed.data.rag_enabled,
    mental_health_enabled: parsed.data.mental_health_enabled,
    safety_enabled: parsed.data.safety_enabled,
    handoff_enabled: parsed.data.handoff_enabled,
    is_active: true,
    general_model: parsed.data.general_model,
    rag_model: parsed.data.rag_model,
    safety_model: parsed.data.safety_model,
    embedding_model: parsed.data.embedding_model,
    classification_enabled: parsed.data.classification_enabled,
    system_instruction: parsed.data.system_instruction || null,
  };

  const query = current.id
    ? supabase.from("bot_settings").update(payload).eq("id", current.id)
    : supabase.from("bot_settings").insert({ ...payload, tenant_id: id });

  const { data, error } = await query.select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabase.from("audit_logs").insert({
    tenant_id: id,
    actor_user_id: admin.appUser.id,
    action: "tenant_ai_settings.updated",
    target_type: "bot_settings",
    target_id: data.id,
    metadata: payload,
  });

  return NextResponse.json(data);
}
