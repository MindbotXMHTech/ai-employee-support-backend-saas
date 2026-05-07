import { AI_MODELS } from "@/lib/ai/models";
import { createSupabaseServiceClient, hasSupabaseConfig } from "@/lib/supabase/server";

export interface PlatformAiSettings {
  id?: string;
  tenant_id?: string | null;
  name: string;
  default_language: string;
  max_sentences: number;
  tone: string;
  general_model: string;
  rag_model: string;
  safety_model: string;
  embedding_model: string;
  rag_enabled: boolean;
  mental_health_enabled: boolean;
  safety_enabled: boolean;
  handoff_enabled: boolean;
  classification_enabled: boolean;
  system_instruction: string | null;
}

export const DEFAULT_PLATFORM_AI_SETTINGS: PlatformAiSettings = {
  name: "Central Employee Support Bot",
  default_language: "th",
  max_sentences: 5,
  tone: "warm, professional",
  general_model: AI_MODELS.GENERAL,
  rag_model: AI_MODELS.RAG,
  safety_model: AI_MODELS.SAFETY,
  embedding_model: AI_MODELS.EMBEDDING,
  rag_enabled: true,
  mental_health_enabled: true,
  safety_enabled: true,
  handoff_enabled: true,
  classification_enabled: true,
  system_instruction: null,
};

function normalizePlatformAiSettings(row: Partial<PlatformAiSettings> | null | undefined): PlatformAiSettings {
  const languages = String(row?.default_language ?? DEFAULT_PLATFORM_AI_SETTINGS.default_language)
    .split(",")
    .map((language) => language.trim())
    .filter((language) => ["th", "en"].includes(language));

  return {
    ...DEFAULT_PLATFORM_AI_SETTINGS,
    ...row,
    default_language: Array.from(new Set(languages.length ? languages : ["th"])).join(","),
    max_sentences: Math.min(Math.max(Number(row?.max_sentences ?? DEFAULT_PLATFORM_AI_SETTINGS.max_sentences), 1), 5),
    rag_enabled: row?.rag_enabled ?? DEFAULT_PLATFORM_AI_SETTINGS.rag_enabled,
    mental_health_enabled: row?.mental_health_enabled ?? DEFAULT_PLATFORM_AI_SETTINGS.mental_health_enabled,
    safety_enabled: row?.safety_enabled ?? DEFAULT_PLATFORM_AI_SETTINGS.safety_enabled,
    handoff_enabled: row?.handoff_enabled ?? DEFAULT_PLATFORM_AI_SETTINGS.handoff_enabled,
    classification_enabled: row?.classification_enabled ?? DEFAULT_PLATFORM_AI_SETTINGS.classification_enabled,
  };
}

export const normalizeAiSettings = normalizePlatformAiSettings;

export async function getPlatformAiSettings() {
  if (!hasSupabaseConfig()) return DEFAULT_PLATFORM_AI_SETTINGS;

  const supabase = createSupabaseServiceClient();
  const { data } = await supabase
    .from("platform_bot_settings")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (data) return normalizePlatformAiSettings(data);

  const { data: created } = await supabase
    .from("platform_bot_settings")
    .insert({
      name: DEFAULT_PLATFORM_AI_SETTINGS.name,
      default_language: DEFAULT_PLATFORM_AI_SETTINGS.default_language,
      max_sentences: DEFAULT_PLATFORM_AI_SETTINGS.max_sentences,
      tone: DEFAULT_PLATFORM_AI_SETTINGS.tone,
      general_model: DEFAULT_PLATFORM_AI_SETTINGS.general_model,
      rag_model: DEFAULT_PLATFORM_AI_SETTINGS.rag_model,
      safety_model: DEFAULT_PLATFORM_AI_SETTINGS.safety_model,
      embedding_model: DEFAULT_PLATFORM_AI_SETTINGS.embedding_model,
      rag_enabled: DEFAULT_PLATFORM_AI_SETTINGS.rag_enabled,
      mental_health_enabled: DEFAULT_PLATFORM_AI_SETTINGS.mental_health_enabled,
      safety_enabled: DEFAULT_PLATFORM_AI_SETTINGS.safety_enabled,
      handoff_enabled: DEFAULT_PLATFORM_AI_SETTINGS.handoff_enabled,
      classification_enabled: DEFAULT_PLATFORM_AI_SETTINGS.classification_enabled,
    })
    .select("*")
    .single();

  return normalizePlatformAiSettings(created);
}

export async function getTenantAiSettings(tenantId: string) {
  if (!hasSupabaseConfig()) return DEFAULT_PLATFORM_AI_SETTINGS;

  const supabase = createSupabaseServiceClient();
  const { data } = await supabase
    .from("bot_settings")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (data) return normalizePlatformAiSettings(data);

  const defaults = await getPlatformAiSettings();
  const { data: created } = await supabase
    .from("bot_settings")
    .insert({
      tenant_id: tenantId,
      name: defaults.name,
      tone: defaults.tone,
      default_language: defaults.default_language,
      max_sentences: defaults.max_sentences,
      rag_enabled: defaults.rag_enabled,
      mental_health_enabled: defaults.mental_health_enabled,
      safety_enabled: defaults.safety_enabled,
      handoff_enabled: defaults.handoff_enabled,
      is_active: true,
      general_model: defaults.general_model,
      rag_model: defaults.rag_model,
      safety_model: defaults.safety_model,
      embedding_model: defaults.embedding_model,
      classification_enabled: defaults.classification_enabled,
      system_instruction: defaults.system_instruction,
    })
    .select("*")
    .single();

  return normalizePlatformAiSettings(created);
}

export async function getModelPricingOptions() {
  const fallback = [
    DEFAULT_PLATFORM_AI_SETTINGS.general_model,
    DEFAULT_PLATFORM_AI_SETTINGS.rag_model,
    DEFAULT_PLATFORM_AI_SETTINGS.safety_model,
    DEFAULT_PLATFORM_AI_SETTINGS.embedding_model,
  ];
  if (!hasSupabaseConfig()) return Array.from(new Set(fallback));

  const supabase = createSupabaseServiceClient();
  const { data } = await supabase.from("model_pricing").select("model_name, active").order("model_name");
  const activeModels = (data ?? [])
    .filter((model) => model.active !== false)
    .map((model) => model.model_name as string);

  return Array.from(new Set([...activeModels, ...fallback]));
}
