create table public.tenant_company_codes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null unique,
  status text default 'active' check (status in ('active', 'revoked')),
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table public.employee_tenant_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  external_user_id text not null,
  channel text not null default 'api',
  company_code_id uuid references public.tenant_company_codes(id),
  verified_at timestamptz not null default now(),
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (external_user_id, channel)
);

create table public.platform_bot_settings (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Central Employee Support Bot',
  central_bot_secret_hash text,
  default_language text default 'th',
  max_sentences integer default 5,
  rag_enabled boolean default true,
  mental_health_enabled boolean default true,
  safety_enabled boolean default true,
  handoff_enabled boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tenant_company_codes_tenant_idx on public.tenant_company_codes(tenant_id);
create index employee_tenant_links_tenant_idx on public.employee_tenant_links(tenant_id);
create index employee_tenant_links_external_idx on public.employee_tenant_links(external_user_id, channel);

create trigger set_employee_tenant_links_updated_at before update on public.employee_tenant_links for each row execute function private.set_updated_at();
create trigger set_platform_bot_settings_updated_at before update on public.platform_bot_settings for each row execute function private.set_updated_at();

alter table public.tenant_company_codes enable row level security;
alter table public.employee_tenant_links enable row level security;
alter table public.platform_bot_settings enable row level security;

create policy "tenant scoped company codes"
on public.tenant_company_codes for all
using (public.is_platform_admin() or public.is_tenant_admin(tenant_id))
with check (public.is_platform_admin() or public.is_tenant_admin(tenant_id));

create policy "tenant scoped employee links"
on public.employee_tenant_links for all
using (public.is_platform_admin() or public.is_tenant_admin(tenant_id))
with check (public.is_platform_admin() or public.is_tenant_admin(tenant_id));

create policy "platform admins manage central bot settings"
on public.platform_bot_settings for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

insert into public.platform_bot_settings (name)
select 'Central Employee Support Bot'
where not exists (select 1 from public.platform_bot_settings);
