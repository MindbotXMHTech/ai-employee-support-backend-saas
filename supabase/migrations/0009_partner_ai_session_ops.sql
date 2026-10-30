create table public.processed_partner_events (
  event_id text primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  op text not null check (op in ('set_base', 'add_topup', 'reset_base')),
  amount integer null,
  applied_at timestamptz not null default now()
);

alter table public.processed_partner_events enable row level security;

create domain public.partner_ai_session_op_outcome as text
  constraint partner_ai_session_op_outcome_check
  check (value in ('applied', 'replayed', 'company_code_not_found', 'event_id_conflict'));

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
  v_inserted integer;
  v_stored public.processed_partner_events%rowtype;
  v_before record;
  v_after record;
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

  insert into public.processed_partner_events (event_id, tenant_id, op, amount)
  values (p_event_id, v_tenant, p_op, p_amount)
  on conflict on constraint processed_partner_events_pkey do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    select e.event_id, e.tenant_id, e.op, e.amount, e.applied_at
    into v_stored
    from public.processed_partner_events e
    where e.event_id = p_event_id;

    base_limit := 0;
    base_used := 0;
    topup_balance := 0;

    if v_stored.tenant_id = v_tenant
      and v_stored.op = p_op
      and v_stored.amount is not distinct from p_amount then
      outcome := 'replayed';
      select q.base_limit, q.base_used, q.topup_balance
      into base_limit, base_used, topup_balance
      from public.tenant_ai_session_quota q
      where q.tenant_id = v_tenant;
      if not found then
        base_limit := 0;
        base_used := 0;
        topup_balance := 0;
      end if;
    else
      outcome := 'event_id_conflict';
    end if;
    return next;
    return;
  end if;

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

revoke all on table public.processed_partner_events from public, anon, authenticated, service_role;

revoke all on function public.apply_partner_ai_session_op(text, text, integer, text, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.apply_partner_ai_session_op(text, text, integer, text, timestamptz, text)
  to service_role;
