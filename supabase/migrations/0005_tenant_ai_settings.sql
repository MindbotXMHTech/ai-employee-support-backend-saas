alter table public.bot_settings
  add column if not exists general_model text,
  add column if not exists rag_model text,
  add column if not exists safety_model text,
  add column if not exists embedding_model text,
  add column if not exists system_instruction text,
  add column if not exists classification_enabled boolean default true;

insert into public.bot_settings (
  tenant_id,
  name,
  tone,
  default_language,
  max_sentences,
  rag_enabled,
  mental_health_enabled,
  safety_enabled,
  handoff_enabled,
  is_active,
  general_model,
  rag_model,
  safety_model,
  embedding_model,
  classification_enabled
)
select
  tenants.id,
  'Central Employee Support Bot',
  'warm, professional',
  'th',
  5,
  true,
  true,
  true,
  true,
  true,
  'gpt-5-nano',
  'gpt-5-mini',
  'gpt-5-mini',
  'text-embedding-3-small',
  true
from public.tenants
where not exists (
  select 1
  from public.bot_settings
  where bot_settings.tenant_id = tenants.id
);

update public.bot_settings
set
  name = coalesce(name, 'Central Employee Support Bot'),
  tone = coalesce(tone, 'warm, professional'),
  default_language = coalesce(default_language, 'th'),
  max_sentences = coalesce(max_sentences, 5),
  rag_enabled = coalesce(rag_enabled, true),
  mental_health_enabled = coalesce(mental_health_enabled, true),
  safety_enabled = coalesce(safety_enabled, true),
  handoff_enabled = coalesce(handoff_enabled, true),
  is_active = coalesce(is_active, true),
  general_model = coalesce(general_model, 'gpt-5-nano'),
  rag_model = coalesce(rag_model, 'gpt-5-mini'),
  safety_model = coalesce(safety_model, 'gpt-5-mini'),
  embedding_model = coalesce(embedding_model, 'text-embedding-3-small'),
  classification_enabled = coalesce(classification_enabled, true);

drop policy if exists "tenant scoped bot settings" on public.bot_settings;

create policy "platform admins manage tenant bot settings"
on public.bot_settings for all
using (public.is_platform_admin())
with check (public.is_platform_admin());
