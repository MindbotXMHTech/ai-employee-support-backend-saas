-- Tenant-scoped tokens for HTTP clients that cannot set custom headers (e.g. some workflow builders).
-- Raw token is shown once at creation; only hash is stored.

create table public.workflow_tokens (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text,
  token_hash text not null unique,
  token_prefix text not null,
  status text default 'active' check (status in ('active', 'revoked')),
  last_used_at timestamptz,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index workflow_tokens_hash_active_idx on public.workflow_tokens(token_hash, status);

alter table public.workflow_tokens enable row level security;

create policy "tenant scoped workflow tokens" on public.workflow_tokens for all
  using (public.is_platform_admin() or public.is_tenant_admin(tenant_id))
  with check (public.is_platform_admin() or public.is_tenant_admin(tenant_id));
