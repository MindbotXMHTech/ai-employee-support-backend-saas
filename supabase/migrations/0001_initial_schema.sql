create extension if not exists "pgcrypto";
create extension if not exists "vector";

create schema if not exists private;

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  plan text not null check (plan in ('trial', 'pro')),
  status text not null check (status in ('active', 'suspended', 'expired')),
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  monthly_message_limit integer not null default 500,
  storage_limit_mb integer not null default 50,
  max_files integer not null default 10,
  max_bots integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenant_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  company_name text,
  industry text,
  company_description text,
  hr_contact_name text,
  hr_contact_email text,
  hr_contact_phone text,
  support_contact_info text,
  emergency_contact_info text,
  default_language text default 'th',
  disclaimer_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id)
);

create table public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  email text,
  display_name text,
  role text not null check (role in ('platform_admin', 'tenant_admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenant_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null check (role in ('tenant_admin')),
  status text default 'active' check (status in ('active', 'invited', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create table public.bot_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  tone text,
  default_language text default 'th',
  max_sentences integer default 5,
  rag_enabled boolean default true,
  mental_health_enabled boolean default true,
  safety_enabled boolean default true,
  handoff_enabled boolean default false,
  custom_instruction text,
  is_active boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text,
  key_hash text not null unique,
  key_prefix text not null,
  status text default 'active' check (status in ('active', 'revoked')),
  last_used_at timestamptz,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  uploaded_by uuid references public.users(id),
  file_name text not null,
  file_type text,
  file_size_bytes bigint,
  storage_path text,
  status text default 'uploaded' check (status in ('uploaded', 'processing', 'ready', 'failed')),
  document_category text check (document_category in ('benefits', 'welfare', 'leave_policy', 'insurance', 'hr_faq', 'other')),
  processing_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  chunk_index integer,
  content text not null,
  embedding vector(1536),
  token_count integer,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table public.external_users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  external_user_id text not null,
  channel text,
  display_name text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, external_user_id, channel)
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  external_user_id uuid references public.external_users(id),
  bot_setting_id uuid references public.bot_settings(id),
  external_conversation_id text,
  channel text default 'api',
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,
  external_user_id uuid references public.external_users(id),
  role text check (role in ('user', 'assistant', 'system')),
  content text not null,
  message_type text check (message_type in ('general', 'rag', 'mental_health', 'safety', 'crisis', 'out_of_scope', 'quota_exceeded')),
  model_used text,
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  estimated_cost_usd numeric,
  safety_level text check (safety_level in ('normal', 'medium', 'high', 'crisis')),
  sources jsonb,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table public.user_memories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  external_user_id uuid not null references public.external_users(id),
  memory_key text,
  memory_value text,
  memory_type text,
  confidence numeric,
  is_sensitive boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.usage_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  external_user_id uuid references public.external_users(id),
  conversation_id uuid references public.conversations(id),
  message_id uuid references public.messages(id),
  model_used text,
  request_type text check (request_type in ('general', 'rag', 'embedding', 'safety', 'classification', 'playground')),
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  estimated_cost_usd numeric,
  created_at timestamptz not null default now()
);

create table public.escalation_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  enabled boolean default false,
  hr_contact_email text,
  counselor_contact_email text,
  handoff_url text,
  handoff_button_text text,
  emergency_message text,
  notify_on_high boolean default false,
  notify_on_crisis boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  actor_user_id uuid references public.users(id),
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table public.semantic_cache (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  query_hash text,
  normalized_query text,
  response text,
  message_type text,
  sources jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.model_pricing (
  id uuid primary key default gen_random_uuid(),
  model_name text unique,
  input_per_1m numeric,
  output_per_1m numeric,
  active boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tenants_status_idx on public.tenants(status);
create index tenant_members_tenant_user_idx on public.tenant_members(tenant_id, user_id);
create index bot_settings_tenant_active_idx on public.bot_settings(tenant_id, is_active);
create index api_keys_hash_active_idx on public.api_keys(key_hash, status);
create index documents_tenant_status_idx on public.documents(tenant_id, status);
create index document_chunks_tenant_idx on public.document_chunks(tenant_id);
create index document_chunks_embedding_idx on public.document_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index external_users_tenant_external_idx on public.external_users(tenant_id, external_user_id, channel);
create index conversations_tenant_updated_idx on public.conversations(tenant_id, updated_at desc);
create index messages_tenant_created_idx on public.messages(tenant_id, created_at desc);
create index messages_conversation_created_idx on public.messages(conversation_id, created_at);
create index usage_logs_tenant_created_idx on public.usage_logs(tenant_id, created_at desc);
create index usage_logs_tenant_type_idx on public.usage_logs(tenant_id, request_type);
create index semantic_cache_tenant_hash_idx on public.semantic_cache(tenant_id, query_hash);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_tenants_updated_at before update on public.tenants for each row execute function private.set_updated_at();
create trigger set_tenant_profiles_updated_at before update on public.tenant_profiles for each row execute function private.set_updated_at();
create trigger set_users_updated_at before update on public.users for each row execute function private.set_updated_at();
create trigger set_tenant_members_updated_at before update on public.tenant_members for each row execute function private.set_updated_at();
create trigger set_bot_settings_updated_at before update on public.bot_settings for each row execute function private.set_updated_at();
create trigger set_documents_updated_at before update on public.documents for each row execute function private.set_updated_at();
create trigger set_external_users_updated_at before update on public.external_users for each row execute function private.set_updated_at();
create trigger set_conversations_updated_at before update on public.conversations for each row execute function private.set_updated_at();
create trigger set_user_memories_updated_at before update on public.user_memories for each row execute function private.set_updated_at();
create trigger set_escalation_settings_updated_at before update on public.escalation_settings for each row execute function private.set_updated_at();
create trigger set_model_pricing_updated_at before update on public.model_pricing for each row execute function private.set_updated_at();

create or replace function public.get_current_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.users where auth_user_id = auth.uid();
$$;

create or replace function public.get_current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.users where auth_user_id = auth.uid();
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where auth_user_id = auth.uid()
    and role = 'platform_admin'
  );
$$;

create or replace function public.is_tenant_admin(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_members tm
    join public.users u on u.id = tm.user_id
    where u.auth_user_id = auth.uid()
      and tm.tenant_id = target_tenant_id
      and tm.role = 'tenant_admin'
      and tm.status = 'active'
  );
$$;

create or replace function public.get_user_tenant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select tm.tenant_id
  from public.tenant_members tm
  join public.users u on u.id = tm.user_id
  where u.auth_user_id = auth.uid()
    and tm.status = 'active';
$$;

create or replace function public.match_document_chunks(
  target_tenant_id uuid,
  query_embedding vector(1536),
  match_count integer default 5,
  similarity_threshold double precision default 0.72
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  metadata jsonb,
  similarity double precision,
  document_name text,
  document_category text
)
language sql
stable
as $$
  select
    dc.id,
    dc.document_id,
    dc.content,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) as similarity,
    d.file_name as document_name,
    d.document_category
  from public.document_chunks dc
  join public.documents d on d.id = dc.document_id
  where dc.tenant_id = target_tenant_id
    and d.tenant_id = target_tenant_id
    and d.status = 'ready'
    and dc.embedding is not null
    and 1 - (dc.embedding <=> query_embedding) >= similarity_threshold
  order by dc.embedding <=> query_embedding
  limit match_count;
$$;

insert into public.model_pricing (model_name, input_per_1m, output_per_1m)
values
  ('gpt-5-nano', 0.05, 0.40),
  ('gpt-5-mini', 0.25, 2.00),
  ('text-embedding-3-small', 0.02, 0)
on conflict (model_name) do update
set input_per_1m = excluded.input_per_1m,
    output_per_1m = excluded.output_per_1m,
    active = true;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tenant-documents',
  'tenant-documents',
  false,
  52428800,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = 52428800,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.tenants enable row level security;
alter table public.tenant_profiles enable row level security;
alter table public.users enable row level security;
alter table public.tenant_members enable row level security;
alter table public.bot_settings enable row level security;
alter table public.api_keys enable row level security;
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.external_users enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.user_memories enable row level security;
alter table public.usage_logs enable row level security;
alter table public.escalation_settings enable row level security;
alter table public.audit_logs enable row level security;
alter table public.semantic_cache enable row level security;
alter table public.model_pricing enable row level security;

create policy "platform admins manage tenants" on public.tenants for all using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "tenant admins read own tenants" on public.tenants for select using (public.is_tenant_admin(id));

create policy "users read self or platform" on public.users for select using (public.is_platform_admin() or auth_user_id = auth.uid());
create policy "platform admins manage users" on public.users for all using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy "tenant scoped profiles" on public.tenant_profiles for all using (public.is_platform_admin() or public.is_tenant_admin(tenant_id)) with check (public.is_platform_admin() or public.is_tenant_admin(tenant_id));
create policy "tenant scoped members" on public.tenant_members for all using (public.is_platform_admin() or public.is_tenant_admin(tenant_id)) with check (public.is_platform_admin() or public.is_tenant_admin(tenant_id));
create policy "tenant scoped bot settings" on public.bot_settings for all using (public.is_platform_admin() or public.is_tenant_admin(tenant_id)) with check (public.is_platform_admin() or public.is_tenant_admin(tenant_id));
create policy "tenant scoped api keys" on public.api_keys for all using (public.is_platform_admin() or public.is_tenant_admin(tenant_id)) with check (public.is_platform_admin() or public.is_tenant_admin(tenant_id));
create policy "tenant scoped documents" on public.documents for all using (public.is_platform_admin() or public.is_tenant_admin(tenant_id)) with check (public.is_platform_admin() or public.is_tenant_admin(tenant_id));
create policy "tenant scoped chunks" on public.document_chunks for all using (public.is_platform_admin() or public.is_tenant_admin(tenant_id)) with check (public.is_platform_admin() or public.is_tenant_admin(tenant_id));
create policy "tenant scoped external users" on public.external_users for all using (public.is_platform_admin() or public.is_tenant_admin(tenant_id)) with check (public.is_platform_admin() or public.is_tenant_admin(tenant_id));
create policy "tenant scoped conversations" on public.conversations for all using (public.is_platform_admin() or public.is_tenant_admin(tenant_id)) with check (public.is_platform_admin() or public.is_tenant_admin(tenant_id));
create policy "tenant scoped messages" on public.messages for all using (public.is_platform_admin() or public.is_tenant_admin(tenant_id)) with check (public.is_platform_admin() or public.is_tenant_admin(tenant_id));
create policy "tenant scoped memories" on public.user_memories for all using (public.is_platform_admin() or public.is_tenant_admin(tenant_id)) with check (public.is_platform_admin() or public.is_tenant_admin(tenant_id));
create policy "tenant scoped usage logs" on public.usage_logs for all using (public.is_platform_admin() or public.is_tenant_admin(tenant_id)) with check (public.is_platform_admin() or public.is_tenant_admin(tenant_id));
create policy "tenant scoped escalation settings" on public.escalation_settings for all using (public.is_platform_admin() or public.is_tenant_admin(tenant_id)) with check (public.is_platform_admin() or public.is_tenant_admin(tenant_id));
create policy "tenant scoped audit logs" on public.audit_logs for all using (public.is_platform_admin() or tenant_id is null or public.is_tenant_admin(tenant_id)) with check (public.is_platform_admin() or tenant_id is null or public.is_tenant_admin(tenant_id));
create policy "tenant scoped semantic cache" on public.semantic_cache for all using (public.is_platform_admin() or public.is_tenant_admin(tenant_id)) with check (public.is_platform_admin() or public.is_tenant_admin(tenant_id));
create policy "platform admins manage model pricing" on public.model_pricing for all using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "tenant admins read model pricing" on public.model_pricing for select using (public.is_platform_admin() or public.get_current_user_id() is not null);

create policy "tenant admins read document objects"
on storage.objects for select
using (
  bucket_id = 'tenant-documents'
  and (
    public.is_platform_admin()
    or public.is_tenant_admin(((storage.foldername(name))[2])::uuid)
  )
);

create policy "tenant admins insert document objects"
on storage.objects for insert
with check (
  bucket_id = 'tenant-documents'
  and (
    public.is_platform_admin()
    or public.is_tenant_admin(((storage.foldername(name))[2])::uuid)
  )
);

create policy "tenant admins update document objects"
on storage.objects for update
using (
  bucket_id = 'tenant-documents'
  and (
    public.is_platform_admin()
    or public.is_tenant_admin(((storage.foldername(name))[2])::uuid)
  )
)
with check (
  bucket_id = 'tenant-documents'
  and (
    public.is_platform_admin()
    or public.is_tenant_admin(((storage.foldername(name))[2])::uuid)
  )
);

create policy "tenant admins delete document objects"
on storage.objects for delete
using (
  bucket_id = 'tenant-documents'
  and (
    public.is_platform_admin()
    or public.is_tenant_admin(((storage.foldername(name))[2])::uuid)
  )
);
