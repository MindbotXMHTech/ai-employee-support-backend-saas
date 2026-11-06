-- One successful chat spend per event_id. The claim and the consume commit together,
-- so a timeout after a successful spend followed by a retry does not spend a second unit.
-- A spend that does not happen releases the claim in the same transaction, so a later
-- retry can spend once a balance exists. consume_ai_session itself is still not an idempotency key.

create table public.processed_ai_session_consumes (
  event_id text primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  applied_at timestamptz not null default now()
);

alter table public.processed_ai_session_consumes enable row level security;

create domain public.ai_session_consume_event_outcome as text
  constraint ai_session_consume_event_outcome_check
  check (value in (
    'applied',
    'replayed',
    'exhausted',
    'not_provisioned',
    'company_code_not_found',
    'event_id_conflict'
  ));

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
  v_inserted integer;
  v_stored public.processed_ai_session_consumes%rowtype;
  v_consumed record;
  v_quota public.tenant_ai_session_quota%rowtype;
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

  insert into public.processed_ai_session_consumes (event_id, tenant_id)
  values (p_event_id, v_tenant)
  on conflict on constraint processed_ai_session_consumes_pkey do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    select e.event_id, e.tenant_id, e.applied_at
    into v_stored
    from public.processed_ai_session_consumes e
    where e.event_id = p_event_id;

    if v_stored.tenant_id is distinct from v_tenant then
      outcome := 'event_id_conflict';
      base_limit := 0;
      base_used := 0;
      topup_balance := 0;
      return next;
      return;
    end if;

    select q.base_limit, q.base_used, q.topup_balance
    into v_quota.base_limit, v_quota.base_used, v_quota.topup_balance
    from public.tenant_ai_session_quota q
    where q.tenant_id = v_tenant;

    if not found then
      outcome := 'not_provisioned';
      base_limit := 0;
      base_used := 0;
      topup_balance := 0;
    else
      outcome := 'replayed';
      base_limit := v_quota.base_limit;
      base_used := v_quota.base_used;
      topup_balance := v_quota.topup_balance;
    end if;
    return next;
    return;
  end if;

  select f.outcome, f.base_limit, f.base_used, f.topup_balance
  into v_consumed
  from public.consume_ai_session(v_tenant) f;

  select q.tenant_id
  into v_quota.tenant_id
  from public.tenant_ai_session_quota q
  where q.tenant_id = v_tenant;

  if not found then
    outcome := 'not_provisioned';
    base_limit := 0;
    base_used := 0;
    topup_balance := 0;
  elsif v_consumed.outcome = 'exhausted' then
    outcome := 'exhausted';
    base_limit := v_consumed.base_limit;
    base_used := v_consumed.base_used;
    topup_balance := v_consumed.topup_balance;
  else
    outcome := 'applied';
    base_limit := v_consumed.base_limit;
    base_used := v_consumed.base_used;
    topup_balance := v_consumed.topup_balance;
  end if;

  if outcome = 'not_provisioned' or outcome = 'exhausted' then
    delete from public.processed_ai_session_consumes
    where event_id = p_event_id;
  end if;

  return next;
end;
$$;

revoke all on table public.processed_ai_session_consumes from public, anon, authenticated, service_role;

revoke all on function public.consume_ai_session_event(text, text) from public, anon, authenticated;
grant execute on function public.consume_ai_session_event(text, text) to service_role;
