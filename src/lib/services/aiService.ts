import OpenAI from "openai";
import { env } from "@/lib/env";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { classifyMessageRuleBased } from "@/lib/services/classificationService";
import { estimateCost } from "@/lib/services/costService";
import { checkQuota, getQuotaSnapshot } from "@/lib/services/quotaService";
import { buildHandoff, classifySafetyLevelRuleBased, crisisResponse } from "@/lib/services/safetyService";
import { enforceTenantAvailability } from "@/lib/services/tenantService";
import { logMessage, logUsage } from "@/lib/services/usageService";
import { generalSupportPrompt, mentalHealthPrompt, outOfScopeResponse } from "@/lib/services/promptService";
import { getTenantAiSettings, type PlatformAiSettings } from "@/lib/services/platformAiSettingsService";
import type {
  ChatApiResponse,
  ClassificationCategory,
  MessageType,
  RequestType,
  SafetyLevel,
  SourceDocument,
  Tenant,
} from "@/lib/types";
import type { ChatRequestInput } from "@/lib/validation/chat";

function fallbackAnswer(category: ClassificationCategory) {
  if (category === "welfare_rag") {
    return "ยังไม่พบข้อมูลนี้ในเอกสารของบริษัท กรุณาติดต่อ HR เพื่อยืนยันข้อมูลครับ";
  }
  if (category === "mental_health_support" || category === "mental_health_sensitive") {
    return "ขอบคุณที่เล่าให้ฟังนะครับ ลองหยุดพักสั้น ๆ หายใจช้า ๆ และคุยกับคนที่ไว้ใจได้หากรู้สึกหนักเกินไป หากอาการกระทบชีวิตประจำวัน ควรติดต่อผู้เชี่ยวชาญหรือ HR เพื่อขอการสนับสนุนครับ";
  }
  if (category === "out_of_scope") return outOfScopeResponse();
  return "สวัสดีครับ ผมช่วยตอบคำถามเกี่ยวกับสวัสดิการ นโยบาย HR และให้กำลังใจเรื่องการทำงานได้แบบสั้นและชัดเจนครับ";
}

function categoryToMessageType(category: ClassificationCategory): MessageType {
  if (category === "welfare_rag") return "general";
  if (category === "mental_health_support" || category === "mental_health_sensitive") return "mental_health";
  if (category === "crisis") return "crisis";
  if (category === "out_of_scope") return "out_of_scope";
  return "general";
}

function categoryToRequestType(category: ClassificationCategory): RequestType {
  if (category === "mental_health_sensitive") return "safety";
  return "general";
}

function modelForCategory(category: ClassificationCategory, safetyLevel: SafetyLevel, settings: PlatformAiSettings) {
  if (category === "crisis" || category === "mental_health_sensitive" || safetyLevel === "high") return settings.safety_model;
  return settings.general_model;
}

async function generateText(input: { model: string; system: string; user: string }) {
  if (!env.OPENAI_API_KEY) {
    return { text: "", inputTokens: Math.ceil((input.system.length + input.user.length) / 4), outputTokens: 0 };
  }

  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const response = await openai.responses.create({
    model: input.model,
    input: [
      { role: "system", content: input.system },
      { role: "user", content: input.user },
    ],
  });

  return {
    text: response.output_text.trim(),
    inputTokens: response.usage?.input_tokens ?? Math.ceil((input.system.length + input.user.length) / 4),
    outputTokens: response.usage?.output_tokens ?? Math.ceil(response.output_text.length / 4),
  };
}

async function getTenantProfile(tenantId: string) {
  const supabase = createSupabaseServiceClient();
  const { data } = await supabase.from("tenant_profiles").select("*").eq("tenant_id", tenantId).maybeSingle();
  return data;
}

async function getEscalationSettings(tenantId: string) {
  const supabase = createSupabaseServiceClient();
  const { data } = await supabase.from("escalation_settings").select("*").eq("tenant_id", tenantId).maybeSingle();
  return data;
}

async function getOrCreateExternalUser(input: ChatRequestInput & { tenantId: string }) {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("external_users")
    .upsert(
      {
        tenant_id: input.tenantId,
        external_user_id: input.external_user_id,
        channel: input.channel,
        display_name: typeof input.metadata?.display_name === "string" ? input.metadata.display_name : null,
        metadata: input.metadata ?? {},
      },
      { onConflict: "tenant_id,external_user_id,channel" },
    )
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function getOrCreateConversation(input: {
  tenantId: string;
  externalUserDbId: string;
  externalConversationId?: string;
  channel: string;
  botSettingId?: string | null;
  title?: string;
}) {
  const supabase = createSupabaseServiceClient();
  if (input.externalConversationId) {
    const { data } = await supabase
      .from("conversations")
      .select("id")
      .eq("tenant_id", input.tenantId)
      .eq("external_conversation_id", input.externalConversationId)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }

  const { data, error } = await supabase
    .from("conversations")
    .insert({
      tenant_id: input.tenantId,
      external_user_id: input.externalUserDbId,
      bot_setting_id: input.botSettingId ?? null,
      external_conversation_id: input.externalConversationId ?? null,
      channel: input.channel,
      title: input.title?.slice(0, 120),
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function handleChatRequest(input: ChatRequestInput & { tenant: Tenant }): Promise<ChatApiResponse> {
  const availability = await enforceTenantAvailability(input.tenant);
  if (!availability.ok) {
    return { success: false, error: { code: availability.code, message: availability.message } };
  }

  const quotaCheck = await checkQuota(input.tenant);
  if (!quotaCheck.ok) {
    return {
      success: true,
      reply: "ขณะนี้จำนวนข้อความของบริษัทถึงขีดจำกัดของแพ็กเกจแล้ว กรุณาติดต่อผู้ดูแลระบบของบริษัทเพื่ออัปเกรดหรือเพิ่มโควตาครับ",
      message_type: "quota_exceeded",
      safety_level: "normal",
      conversation_id: input.conversation_id ?? "",
      sources: [],
      handoff_required: false,
      handoff: { enabled: false, url: null, button_text: null, message: null },
      quota: quotaCheck.quota,
    };
  }

  const [profile, aiSettings, escalationSettings] = await Promise.all([
    getTenantProfile(input.tenant.id),
    getTenantAiSettings(input.tenant.id),
    getEscalationSettings(input.tenant.id),
  ]);
  const category = classifyMessageRuleBased(input.message);
  const safetyLevel = classifySafetyLevelRuleBased(input.message);

  const companyName = profile?.company_name ?? input.tenant.name;
  const externalUserDbId = await getOrCreateExternalUser({ ...input, tenantId: input.tenant.id });
  const conversationId = await getOrCreateConversation({
    tenantId: input.tenant.id,
    externalUserDbId,
    externalConversationId: input.conversation_id,
    channel: input.channel,
    botSettingId: null,
    title: input.message,
  });

  await logMessage({
    tenantId: input.tenant.id,
    conversationId,
    externalUserId: externalUserDbId,
    role: "user",
    content: input.message,
    safetyLevel,
    metadata: input.metadata ?? null,
  });

  if (safetyLevel === "crisis" || category === "crisis") {
    const reply = escalationSettings?.emergency_message ?? crisisResponse();
    const messageId = await logMessage({
      tenantId: input.tenant.id,
      conversationId,
      externalUserId: externalUserDbId,
      role: "assistant",
      content: reply,
      messageType: "crisis",
      modelUsed: aiSettings.safety_model,
      safetyLevel: "crisis",
      sources: [],
    });
    await logUsage({ tenantId: input.tenant.id, externalUserId: externalUserDbId, conversationId, messageId, modelUsed: aiSettings.safety_model, requestType: "safety" });
    return {
      success: true,
      reply,
      message_type: "crisis",
      safety_level: "crisis",
      conversation_id: conversationId,
      sources: [],
      handoff_required: true,
      handoff: buildHandoff(escalationSettings),
      quota: await getQuotaSnapshot(input.tenant),
    };
  }

  const model = modelForCategory(category, safetyLevel, aiSettings);
  const sources: SourceDocument[] = [];
  let systemPrompt = generalSupportPrompt(companyName, aiSettings);
  const userPrompt = input.message;

  if ((category === "mental_health_support" || category === "mental_health_sensitive") && aiSettings.mental_health_enabled) {
    systemPrompt = mentalHealthPrompt(aiSettings);
  } else if (category === "out_of_scope") {
    systemPrompt = generalSupportPrompt(companyName, aiSettings);
  }

  let reply = category === "out_of_scope" ? outOfScopeResponse() : "";
  let inputTokens = 0;
  let outputTokens = 0;
  if (!reply) {
    const generated = await generateText({ model, system: systemPrompt, user: userPrompt });
    inputTokens = generated.inputTokens;
    outputTokens = generated.outputTokens;
    reply = generated.text || fallbackAnswer(category);
  }

  const totalTokens = inputTokens + outputTokens;
  const estimatedCostUsd = await estimateCost(model, inputTokens, outputTokens);
  const messageType = categoryToMessageType(category);
  const requestType = categoryToRequestType(category);

  const messageId = await logMessage({
    tenantId: input.tenant.id,
    conversationId,
    externalUserId: externalUserDbId,
    role: "assistant",
    content: reply,
    messageType,
    modelUsed: model,
    inputTokens,
    outputTokens,
    totalTokens,
    estimatedCostUsd,
    safetyLevel,
    sources,
  });
  await logUsage({
    tenantId: input.tenant.id,
    externalUserId: externalUserDbId,
    conversationId,
    messageId,
    modelUsed: model,
    requestType,
    inputTokens,
    outputTokens,
    totalTokens,
    estimatedCostUsd,
  });

  return {
    success: true,
    reply,
    message_type: messageType,
    safety_level: safetyLevel,
    conversation_id: conversationId,
    sources,
    handoff_required: false,
    handoff: buildHandoff({ enabled: aiSettings.handoff_enabled, ...escalationSettings }),
    quota: await getQuotaSnapshot(input.tenant),
  };
}
