alter table public.platform_bot_settings
  add column if not exists general_model text,
  add column if not exists rag_model text,
  add column if not exists safety_model text,
  add column if not exists embedding_model text,
  add column if not exists tone text default 'warm, professional',
  add column if not exists system_instruction text,
  add column if not exists classification_enabled boolean default true;

update public.platform_bot_settings
set
  general_model = coalesce(general_model, 'gpt-5-nano'),
  rag_model = coalesce(rag_model, 'gpt-5-mini'),
  safety_model = coalesce(safety_model, 'gpt-5-mini'),
  embedding_model = coalesce(embedding_model, 'text-embedding-3-small'),
  tone = coalesce(tone, 'warm, professional'),
  default_language = coalesce(default_language, 'th'),
  max_sentences = coalesce(max_sentences, 5),
  rag_enabled = coalesce(rag_enabled, true),
  mental_health_enabled = coalesce(mental_health_enabled, true),
  safety_enabled = coalesce(safety_enabled, true),
  handoff_enabled = coalesce(handoff_enabled, true),
  classification_enabled = coalesce(classification_enabled, true);
