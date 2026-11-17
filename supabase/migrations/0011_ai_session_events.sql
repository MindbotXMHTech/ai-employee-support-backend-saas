-- Topup spent so far, the counterpart of base_used. topup_balance stays what is left.
-- History before this migration did not track it, so existing tenants start at 0.
alter table public.tenant_ai_session_quota
  add column topup_used integer not null default 0,
  add constraint tenant_ai_session_quota_topup_used_nonneg check (topup_used >= 0);

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

  select q.*
  into current_row
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
    current_row.topup_used := current_row.topup_used + 1;
  else
    decision := 'exhausted';
  end if;

  if decision <> 'exhausted' then
    update public.tenant_ai_session_quota q
    set
      base_used = current_row.base_used,
      topup_balance = current_row.topup_balance,
      topup_used = current_row.topup_used
    where q.tenant_id = consume_ai_session.tenant_id;
  end if;

  outcome := decision;
  base_limit := current_row.base_limit;
  base_used := current_row.base_used;
  topup_balance := current_row.topup_balance;
  return next;
end;
$$;

-- One history row per call, any number per event_id. Chat spends join it as op = 'consume'.
-- Every call that resolves a company is written with its outcome, conflicts included; only the first 'applied' row of an event_id
-- decides replay versus conflict, so an exhausted or unprovisioned call can be retried under
-- the same event_id. It replaces processed_partner_events (0009), which keyed on event_id alone.
create table public.ai_session_events (
  id uuid not null default gen_random_uuid() constraint ai_session_events_pkey primary key,
  event_id text not null,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  op text not null constraint ai_session_events_op_check
    check (op in ('set_base', 'add_topup', 'reset_base', 'consume')),
  outcome text not null constraint ai_session_events_outcome_check
    check (outcome in ('applied', 'replayed', 'exhausted', 'not_provisioned', 'event_id_conflict')),
  amount integer null,
  delta bigint not null,
  base_limit integer not null,
  base_used integer not null,
  topup_balance integer not null,
  topup_used integer not null,
  remaining bigint generated always as (greatest(base_limit - base_used, 0)::bigint + topup_balance) stored,
  created_at timestamptz not null default now()
);

alter table public.ai_session_events enable row level security;

create index ai_session_events_event_id_idx
  on public.ai_session_events (event_id, created_at, id);

insert into public.ai_session_events
  (event_id, tenant_id, op, outcome, amount, delta, base_limit, base_used, topup_balance, topup_used, created_at)
select
  o.event_id, o.tenant_id, o.op, 'applied', o.amount,
  case when a.metadata is null then 0 else
    (greatest((a.metadata -> 'after' ->> 'base_limit')::bigint - (a.metadata -> 'after' ->> 'base_used')::bigint, 0)
      + (a.metadata -> 'after' ->> 'topup_balance')::bigint)
    - (greatest((a.metadata -> 'before' ->> 'base_limit')::bigint - (a.metadata -> 'before' ->> 'base_used')::bigint, 0)
      + (a.metadata -> 'before' ->> 'topup_balance')::bigint)
  end,
  coalesce((a.metadata -> 'after' ->> 'base_limit')::integer, 0),
  coalesce((a.metadata -> 'after' ->> 'base_used')::integer, 0),
  coalesce((a.metadata -> 'after' ->> 'topup_balance')::integer, 0),
  0,
  o.applied_at
from public.processed_partner_events o
left join public.audit_logs a
  on a.action = 'tenant.ai_session_partner_op'
  and a.tenant_id = o.tenant_id
  and a.metadata ->> 'event_id' = o.event_id;

insert into public.ai_session_events
  (event_id, tenant_id, op, outcome, amount, delta, base_limit, base_used, topup_balance, topup_used, created_at)
select c.event_id, c.tenant_id, 'consume', 'applied', null, -1,
  coalesce(q.base_limit, 0), coalesce(q.base_used, 0), coalesce(q.topup_balance, 0), 0, c.applied_at
from public.processed_ai_session_consumes c
left join public.tenant_ai_session_quota q on q.tenant_id = c.tenant_id;

drop table public.processed_partner_events;
drop table public.processed_ai_session_consumes;

revoke all on table public.ai_session_events from public, anon, authenticated, service_role;

create or replace function public.apply_partner_ai_session_op(
  p_company_code text,
  p_op text,
  p_amount integer,
  p_event_id text,
  p_occurred_at timestamptz,
  p_updated_by text
)
returns table (
  outcome public.partner_ai_session_op_outcome,
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
  v_code text := upper(btrim(p_company_code));
  v_tenant uuid;
  v_stored public.ai_session_events%rowtype;
  v_before record;
  v_after record;
  v_topup_used integer := 0;
begin
  if p_event_id is null or btrim(p_event_id) = '' then
    raise exception 'event_id is required' using errcode = '22023';
  end if;

  select c.tenant_id
  into v_tenant
  from public.tenant_company_codes c
  where c.code = v_code
    and c.status = 'active';

  if v_tenant is null then
    outcome := 'company_code_not_found';
    base_limit := 0;
    base_used := 0;
    topup_balance := 0;
    return next;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_event_id, 0));

  select e.*
  into v_stored
  from public.ai_session_events e
  where e.event_id = p_event_id
    and e.outcome = 'applied'
  order by e.created_at, e.id
  limit 1;

  if found then
    base_limit := 0;
    base_used := 0;
    topup_balance := 0;

    if v_stored.tenant_id = v_tenant
      and v_stored.op = p_op
      and v_stored.amount is not distinct from p_amount then
      outcome := 'replayed';
      select q.base_limit, q.base_used, q.topup_balance, q.topup_used
      into base_limit, base_used, topup_balance, v_topup_used
      from public.tenant_ai_session_quota q
      where q.tenant_id = v_tenant;
      if not found then
        base_limit := 0;
        base_used := 0;
        topup_balance := 0;
      end if;

      insert into public.ai_session_events
        (event_id, tenant_id, op, outcome, amount, delta, base_limit, base_used, topup_balance, topup_used)
      values (p_event_id, v_tenant, p_op, 'replayed', p_amount, 0, base_limit, base_used, topup_balance, v_topup_used);
    else
      outcome := 'event_id_conflict';

      insert into public.ai_session_events
        (event_id, tenant_id, op, outcome, amount, delta, base_limit, base_used, topup_balance, topup_used)
      select p_event_id, v_tenant, p_op, 'event_id_conflict', p_amount, 0,
        coalesce(q.base_limit, 0), coalesce(q.base_used, 0), coalesce(q.topup_balance, 0), coalesce(q.topup_used, 0)
      from (select 1) s
      left join public.tenant_ai_session_quota q on q.tenant_id = v_tenant;
    end if;
    return next;
    return;
  end if;

  perform pg_catalog.set_config('app.ai_session_event_logged', 'on', true);
  perform public.upsert_ai_session_quota(v_tenant);

  select q.base_limit, q.base_used, q.topup_balance
  into v_before
  from public.tenant_ai_session_quota q
  where q.tenant_id = v_tenant
  for update;

  if p_op = 'set_base' then
    select f.base_limit, f.base_used, f.topup_balance
    into v_after
    from public.set_ai_session_base(v_tenant, p_amount) f;
  elsif p_op = 'add_topup' then
    select f.base_limit, f.base_used, f.topup_balance
    into v_after
    from public.add_ai_session_topup(v_tenant, p_amount) f;
  else
    select f.base_limit, f.base_used, f.topup_balance
    into v_after
    from public.reset_ai_session_base(v_tenant, p_amount) f;
  end if;

  perform pg_catalog.set_config('app.ai_session_event_logged', '', true);

  select q.topup_used into v_topup_used
  from public.tenant_ai_session_quota q
  where q.tenant_id = v_tenant;

  insert into public.ai_session_events
    (event_id, tenant_id, op, outcome, amount, delta, base_limit, base_used, topup_balance, topup_used)
  values (
    p_event_id,
    v_tenant,
    p_op,
    'applied',
    p_amount,
    (greatest(v_after.base_limit - v_after.base_used, 0)::bigint + v_after.topup_balance)
      - (greatest(v_before.base_limit - v_before.base_used, 0)::bigint + v_before.topup_balance),
    v_after.base_limit,
    v_after.base_used,
    v_after.topup_balance,
    v_topup_used
  );

  insert into public.audit_logs (tenant_id, actor_user_id, action, target_type, target_id, metadata)
  values (
    v_tenant,
    null,
    'tenant.ai_session_partner_op',
    'tenant',
    v_tenant,
    jsonb_build_object(
      'event_id', p_event_id,
      'company_code', v_code,
      'op', p_op,
      'amount', p_amount,
      'before', jsonb_build_object(
        'base_limit', v_before.base_limit,
        'base_used', v_before.base_used,
        'topup_balance', v_before.topup_balance
      ),
      'after', jsonb_build_object(
        'base_limit', v_after.base_limit,
        'base_used', v_after.base_used,
        'topup_balance', v_after.topup_balance
      ),
      'occurred_at', p_occurred_at,
      'updated_by', p_updated_by,
      'source', 'mindbloom_partner_ai_session'
    )
  );

  outcome := 'applied';
  base_limit := v_after.base_limit;
  base_used := v_after.base_used;
  topup_balance := v_after.topup_balance;
  return next;
end;
$$;

revoke all on function public.apply_partner_ai_session_op(text, text, integer, text, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.apply_partner_ai_session_op(text, text, integer, text, timestamptz, text)
  to service_role;

create or replace function public.consume_ai_session_event(
  p_company_code text,
  p_event_id text
)
returns table (
  outcome public.ai_session_consume_event_outcome,
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
  v_code text := upper(btrim(p_company_code));
  v_tenant uuid;
  v_stored public.ai_session_events%rowtype;
  v_consumed record;
  v_quota record;
  v_provisioned boolean;
  v_topup_used integer;
begin
  if p_event_id is null or btrim(p_event_id) = '' then
    raise exception 'event_id is required' using errcode = '22023';
  end if;

  select c.tenant_id
  into v_tenant
  from public.tenant_company_codes c
  where c.code = v_code
    and c.status = 'active';

  if v_tenant is null then
    outcome := 'company_code_not_found';
    base_limit := 0;
    base_used := 0;
    topup_balance := 0;
    return next;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_event_id, 0));

  select e.*
  into v_stored
  from public.ai_session_events e
  where e.event_id = p_event_id
    and e.outcome = 'applied'
  order by e.created_at, e.id
  limit 1;

  select q.base_limit, q.base_used, q.topup_balance, q.topup_used
  into v_quota
  from public.tenant_ai_session_quota q
  where q.tenant_id = v_tenant;
  v_provisioned := found;
  v_topup_used := v_quota.topup_used;

  base_limit := 0;
  base_used := 0;
  topup_balance := 0;

  if v_stored.id is not null and (v_stored.tenant_id <> v_tenant or v_stored.op <> 'consume') then
    outcome := 'event_id_conflict';
    insert into public.ai_session_events
      (event_id, tenant_id, op, outcome, amount, delta, base_limit, base_used, topup_balance, topup_used)
    values (p_event_id, v_tenant, 'consume', 'event_id_conflict', null, 0,
      coalesce(v_quota.base_limit, 0), coalesce(v_quota.base_used, 0),
      coalesce(v_quota.topup_balance, 0), coalesce(v_quota.topup_used, 0));
    return next;
    return;
  end if;

  if not v_provisioned then
    outcome := 'not_provisioned';
    insert into public.ai_session_events
      (event_id, tenant_id, op, outcome, amount, delta, base_limit, base_used, topup_balance, topup_used)
    values (p_event_id, v_tenant, 'consume', 'not_provisioned', null, 0, 0, 0, 0, 0);
    return next;
    return;
  end if;

  if v_stored.id is not null then
    outcome := 'replayed';
    base_limit := v_quota.base_limit;
    base_used := v_quota.base_used;
    topup_balance := v_quota.topup_balance;

    insert into public.ai_session_events
      (event_id, tenant_id, op, outcome, amount, delta, base_limit, base_used, topup_balance, topup_used)
    values (p_event_id, v_tenant, 'consume', 'replayed', null, 0, base_limit, base_used, topup_balance, v_topup_used);
    return next;
    return;
  end if;

  perform pg_catalog.set_config('app.ai_session_event_logged', 'on', true);
  select f.outcome, f.base_limit, f.base_used, f.topup_balance
  into v_consumed
  from public.consume_ai_session(v_tenant) f;
  perform pg_catalog.set_config('app.ai_session_event_logged', '', true);

  base_limit := v_consumed.base_limit;
  base_used := v_consumed.base_used;
  topup_balance := v_consumed.topup_balance;

  if v_consumed.outcome = 'exhausted' then
    outcome := 'exhausted';
    insert into public.ai_session_events
      (event_id, tenant_id, op, outcome, amount, delta, base_limit, base_used, topup_balance, topup_used)
    values (p_event_id, v_tenant, 'consume', 'exhausted', null, 0, base_limit, base_used, topup_balance, v_topup_used);
  else
    outcome := 'applied';
    select q.topup_used into v_topup_used
    from public.tenant_ai_session_quota q
    where q.tenant_id = v_tenant;
    insert into public.ai_session_events
      (event_id, tenant_id, op, outcome, amount, delta, base_limit, base_used, topup_balance, topup_used)
    values (p_event_id, v_tenant, 'consume', 'applied', null, -1, base_limit, base_used, topup_balance, v_topup_used);
  end if;

  return next;
end;
$$;

revoke all on function public.consume_ai_session_event(text, text) from public, anon, authenticated;
grant execute on function public.consume_ai_session_event(text, text) to service_role;

-- A quota change made outside the two logging functions above (a direct call to
-- consume_ai_session, set_ai_session_base, add_ai_session_topup, reset_ai_session_base, or
-- upsert_ai_session_quota) still leaves a history row, under a generated event_id.
-- The logging functions set app.ai_session_event_logged for the transaction while they
-- change the quota, so they are not recorded twice.
create or replace function private.log_direct_ai_session_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_op text;
begin
  if coalesce(pg_catalog.current_setting('app.ai_session_event_logged', true), '') <> '' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_op := case
      when new.topup_balance > 0 then 'add_topup'
      when new.base_limit > 0 then 'set_base'
    end;
  else
    v_op := case
      when new.topup_used > old.topup_used or new.base_used > old.base_used then 'consume'
      when new.base_used < old.base_used then 'reset_base'
      when new.topup_balance > old.topup_balance then 'add_topup'
      when new.base_limit <> old.base_limit then 'set_base'
    end;
  end if;

  if v_op is null then
    return new;
  end if;

  insert into public.ai_session_events
    (event_id, tenant_id, op, outcome, amount, delta, base_limit, base_used, topup_balance, topup_used)
  values (
    'direct:' || gen_random_uuid()::text,
    new.tenant_id,
    v_op,
    'applied',
    null,
    (greatest(new.base_limit - new.base_used, 0)::bigint + new.topup_balance)
      - case when tg_op = 'INSERT' then 0
        else greatest(old.base_limit - old.base_used, 0)::bigint + old.topup_balance end,
    new.base_limit,
    new.base_used,
    new.topup_balance,
    new.topup_used
  );
  return new;
end;
$$;

revoke all on function private.log_direct_ai_session_change() from public, anon, authenticated, service_role;

create trigger log_direct_ai_session_change
  after insert or update on public.tenant_ai_session_quota
  for each row execute function private.log_direct_ai_session_change();
