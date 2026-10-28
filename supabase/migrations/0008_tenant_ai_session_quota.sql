-- One balance row per tenant.
-- Do not copy workflow_tokens. That table grants platform admins and tenant admins.
-- This table has RLS on and no policy, so anon and authenticated match nothing.
-- Do not add a policy.
-- service_role may execute the functions below and may not insert, update, or delete the table.
-- The functions are security definer so they can write as the table owner.
-- search_path is empty on every security definer function so a caller cannot shadow public objects.

create table public.tenant_ai_session_quota (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  base_limit integer not null default 0,
  base_used integer not null default 0,
  topup_balance integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint tenant_ai_session_quota_base_limit_nonneg check (base_limit >= 0),
  constraint tenant_ai_session_quota_base_used_nonneg check (base_used >= 0),
  constraint tenant_ai_session_quota_topup_balance_nonneg check (topup_balance >= 0)
);

create trigger set_tenant_ai_session_quota_updated_at
  before update on public.tenant_ai_session_quota
  for each row execute function private.set_updated_at();

alter table public.tenant_ai_session_quota enable row level security;

comment on table public.tenant_ai_session_quota is
  'One session balance per tenant. Writes go through the ai session quota functions. Direct DML is revoked.';

-- Closed set of consume results. Keep in step with AI_SESSION_CONSUME_OUTCOMES
-- in src/lib/domain/aiSessionQuota.ts. The migration test compares the two.
create domain public.ai_session_consume_outcome as text
  constraint ai_session_consume_outcome_check
  check (value in ('consumed_base', 'consumed_topup', 'exhausted'));

-- Read. Does not insert. Empty result means the tenant has no balance row yet.
create or replace function public.get_ai_session_quota(tenant_id uuid)
returns table (
  base_limit integer,
  base_used integer,
  topup_balance integer,
  updated_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if get_ai_session_quota.tenant_id is null then
    raise exception 'tenant_id is required' using errcode = '22023';
  end if;

  return query
  select q.base_limit, q.base_used, q.topup_balance, q.updated_at
  from public.tenant_ai_session_quota q
  where q.tenant_id = get_ai_session_quota.tenant_id;
end;
$$;

-- Insert the zero row if this tenant has none.
-- If the row exists, leave base_limit, base_used, topup_balance, and updated_at alone.
-- A second call is a no-op. This is the partner-onboarding write and the lazy create.
create or replace function public.upsert_ai_session_quota(tenant_id uuid)
returns table (
  base_limit integer,
  base_used integer,
  topup_balance integer,
  updated_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if upsert_ai_session_quota.tenant_id is null then
    raise exception 'tenant_id is required' using errcode = '22023';
  end if;

  insert into public.tenant_ai_session_quota (tenant_id)
  values (upsert_ai_session_quota.tenant_id)
  -- The argument is also named tenant_id. ON CONFLICT (tenant_id) is ambiguous in plpgsql.
  on conflict on constraint tenant_ai_session_quota_pkey do nothing;

  return query
  select q.base_limit, q.base_used, q.topup_balance, q.updated_at
  from public.tenant_ai_session_quota q
  where q.tenant_id = upsert_ai_session_quota.tenant_id;
end;
$$;

-- Spend one unit, or change nothing.
-- Lock the row, then take base while base_used < base_limit, else take topup while
-- topup_balance > 0, else return exhausted and do not update.
-- A missing row returns exhausted and zeros. It does not insert.
-- RETURNING would see the new counters, so the outcome is decided before the update
-- and stored in `decision`. Do not infer the outcome from the updated row.
-- Concurrent calls block on this row lock. They cannot both take the last unit.
-- A second call spends again. This function is not an idempotency key.
create or replace function public.consume_ai_session(tenant_id uuid)
returns table (
  outcome public.ai_session_consume_outcome,
  base_limit integer,
  base_used integer,
  topup_balance integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_row public.tenant_ai_session_quota%rowtype;
  decision public.ai_session_consume_outcome;
begin
  if consume_ai_session.tenant_id is null then
    raise exception 'tenant_id is required' using errcode = '22023';
  end if;

  select
    q.tenant_id,
    q.base_limit,
    q.base_used,
    q.topup_balance,
    q.updated_at
  into
    current_row.tenant_id,
    current_row.base_limit,
    current_row.base_used,
    current_row.topup_balance,
    current_row.updated_at
  from public.tenant_ai_session_quota q
  where q.tenant_id = consume_ai_session.tenant_id
  for update;

  if not found then
    outcome := 'exhausted';
    base_limit := 0;
    base_used := 0;
    topup_balance := 0;
    return next;
    return;
  end if;

  if current_row.base_used < current_row.base_limit then
    decision := 'consumed_base';
    current_row.base_used := current_row.base_used + 1;
  elsif current_row.topup_balance > 0 then
    decision := 'consumed_topup';
    current_row.topup_balance := current_row.topup_balance - 1;
  else
    decision := 'exhausted';
  end if;

  if decision <> 'exhausted' then
    update public.tenant_ai_session_quota q
    set
      base_used = current_row.base_used,
      topup_balance = current_row.topup_balance
    where q.tenant_id = consume_ai_session.tenant_id;
  end if;

  outcome := decision;
  base_limit := current_row.base_limit;
  base_used := current_row.base_used;
  topup_balance := current_row.topup_balance;
  return next;
end;
$$;

-- Set base_limit. Do not assign base_used or topup_balance.
-- Inserts a zero topup and zero base_used when the row is missing.
-- The same limit again does not update, so updated_at stays put.
-- base_used may remain above the new limit. Availability clamps that.
-- The input is new_base_limit so it does not clash with the output column base_limit.
create or replace function public.set_ai_session_base(tenant_id uuid, new_base_limit integer)
returns table (
  base_limit integer,
  base_used integer,
  topup_balance integer,
  updated_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if set_ai_session_base.tenant_id is null then
    raise exception 'tenant_id is required' using errcode = '22023';
  end if;
  if set_ai_session_base.new_base_limit is null or set_ai_session_base.new_base_limit < 0 then
    raise exception 'base_limit must be >= 0' using errcode = '22023';
  end if;

  insert into public.tenant_ai_session_quota as q (tenant_id, base_limit)
  values (set_ai_session_base.tenant_id, set_ai_session_base.new_base_limit)
  on conflict on constraint tenant_ai_session_quota_pkey do update
  set base_limit = excluded.base_limit
  where q.base_limit is distinct from excluded.base_limit;

  return query
  select q.base_limit, q.base_used, q.topup_balance, q.updated_at
  from public.tenant_ai_session_quota q
  where q.tenant_id = set_ai_session_base.tenant_id;
end;
$$;

-- Add amount to topup_balance. amount must be >= 1.
-- A second call adds again. Retry identity belongs to the caller.
-- Inserts base_limit 0 and base_used 0 when the row is missing.
-- On conflict, add to the stored topup only. Do not assign base_limit or base_used.
-- Integer overflow raises 22003 from Postgres. Do not clamp.
create or replace function public.add_ai_session_topup(tenant_id uuid, amount integer)
returns table (
  base_limit integer,
  base_used integer,
  topup_balance integer,
  updated_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if add_ai_session_topup.tenant_id is null then
    raise exception 'tenant_id is required' using errcode = '22023';
  end if;
  if add_ai_session_topup.amount is null or add_ai_session_topup.amount < 1 then
    raise exception 'topup amount must be >= 1' using errcode = '22023';
  end if;

  insert into public.tenant_ai_session_quota as q (tenant_id, topup_balance)
  values (add_ai_session_topup.tenant_id, add_ai_session_topup.amount)
  on conflict on constraint tenant_ai_session_quota_pkey do update
  set topup_balance = q.topup_balance + excluded.topup_balance;

  return query
  select q.base_limit, q.base_used, q.topup_balance, q.updated_at
  from public.tenant_ai_session_quota q
  where q.tenant_id = add_ai_session_topup.tenant_id;
end;
$$;

-- Set base_used to 0. Set base_limit only when new_base_limit is not null.
-- Do not assign topup_balance.
-- A missing row is inserted with topup 0, base_used 0, and base_limit coalesce(new_base_limit, 0).
-- The same arguments again do not update, so updated_at stays put.
create or replace function public.reset_ai_session_base(tenant_id uuid, new_base_limit integer default null)
returns table (
  base_limit integer,
  base_used integer,
  topup_balance integer,
  updated_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if reset_ai_session_base.tenant_id is null then
    raise exception 'tenant_id is required' using errcode = '22023';
  end if;
  if reset_ai_session_base.new_base_limit is not null and reset_ai_session_base.new_base_limit < 0 then
    raise exception 'base_limit must be >= 0' using errcode = '22023';
  end if;

  insert into public.tenant_ai_session_quota as q (tenant_id, base_limit, base_used)
  values (
    reset_ai_session_base.tenant_id,
    coalesce(reset_ai_session_base.new_base_limit, 0),
    0
  )
  on conflict on constraint tenant_ai_session_quota_pkey do update
  set
    base_used = 0,
    base_limit = case
      when reset_ai_session_base.new_base_limit is null then q.base_limit
      else reset_ai_session_base.new_base_limit
    end
  where q.base_used <> 0
     or (
       reset_ai_session_base.new_base_limit is not null
       and q.base_limit is distinct from reset_ai_session_base.new_base_limit
     );

  return query
  select q.base_limit, q.base_used, q.topup_balance, q.updated_at
  from public.tenant_ai_session_quota q
  where q.tenant_id = reset_ai_session_base.tenant_id;
end;
$$;

revoke all on table public.tenant_ai_session_quota from public, anon, authenticated, service_role;

revoke all on function public.get_ai_session_quota(uuid) from public, anon, authenticated;
revoke all on function public.upsert_ai_session_quota(uuid) from public, anon, authenticated;
revoke all on function public.consume_ai_session(uuid) from public, anon, authenticated;
revoke all on function public.set_ai_session_base(uuid, integer) from public, anon, authenticated;
revoke all on function public.add_ai_session_topup(uuid, integer) from public, anon, authenticated;
revoke all on function public.reset_ai_session_base(uuid, integer) from public, anon, authenticated;

grant execute on function public.get_ai_session_quota(uuid) to service_role;
grant execute on function public.upsert_ai_session_quota(uuid) to service_role;
grant execute on function public.consume_ai_session(uuid) to service_role;
grant execute on function public.set_ai_session_base(uuid, integer) to service_role;
grant execute on function public.add_ai_session_topup(uuid, integer) to service_role;
grant execute on function public.reset_ai_session_base(uuid, integer) to service_role;
