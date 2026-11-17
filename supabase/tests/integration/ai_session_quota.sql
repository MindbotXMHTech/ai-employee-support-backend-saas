-- Spend order, exactly-once event claims, and partner replay.
-- The transaction rolls back, so no fixture remains.
-- Run: npm run test:integration

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.quota_assert(p_ok boolean, p_msg text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT p_ok THEN
    RAISE EXCEPTION 'ai_session_quota integration failed: %', p_msg;
  END IF;
END;
$$;

DO $integration$
DECLARE
  v_a uuid := '13120000-0000-4000-8000-0000000000a1';
  v_b uuid := '13120000-0000-4000-8000-0000000000b1';
  r record;
  n integer;
  m bigint;
  i integer;
BEGIN
  INSERT INTO public.tenants (id, name, slug, plan, status)
  VALUES
    (v_a, 'MB1312 quota A', 'mb1312-quota-a', 'trial', 'active'),
    (v_b, 'MB1312 quota B', 'mb1312-quota-b', 'trial', 'active');

  INSERT INTO public.tenant_company_codes (tenant_id, code, status)
  VALUES
    (v_a, 'MB1312QA', 'active'),
    (v_b, 'MB1312QB', 'active');

  BEGIN
    PERFORM public.consume_ai_session(NULL);
    PERFORM pg_temp.quota_assert(false, 'null tenant_id was accepted');
  EXCEPTION
    WHEN sqlstate '22023' THEN
      NULL;
  END;

  SELECT * INTO r FROM public.consume_ai_session(v_a);
  PERFORM pg_temp.quota_assert(
    r.outcome = 'exhausted' AND r.base_limit = 0 AND r.base_used = 0 AND r.topup_balance = 0,
    format('missing row returned %s %s %s %s', r.outcome, r.base_limit, r.base_used, r.topup_balance)
  );
  SELECT count(*) INTO n FROM public.tenant_ai_session_quota WHERE tenant_id = v_a;
  PERFORM pg_temp.quota_assert(n = 0, 'missing row inserted a quota row');

  PERFORM public.set_ai_session_base(v_a, 2);
  PERFORM public.add_ai_session_topup(v_a, 5);
  SELECT * INTO r FROM public.consume_ai_session(v_a);
  PERFORM pg_temp.quota_assert(
    r.outcome = 'consumed_base' AND r.base_limit = 2 AND r.base_used = 1 AND r.topup_balance = 5,
    format('base first returned %s %s %s %s', r.outcome, r.base_limit, r.base_used, r.topup_balance)
  );

  PERFORM public.consume_ai_session(v_a);
  SELECT * INTO r FROM public.consume_ai_session(v_a);
  PERFORM pg_temp.quota_assert(
    r.outcome = 'consumed_topup' AND r.base_used = 2 AND r.topup_balance = 4,
    format('topup after base returned %s used %s topup %s', r.outcome, r.base_used, r.topup_balance)
  );

  FOR i IN 1..4 LOOP
    PERFORM public.consume_ai_session(v_a);
  END LOOP;
  SELECT * INTO r FROM public.consume_ai_session(v_a);
  PERFORM pg_temp.quota_assert(
    r.outcome = 'exhausted' AND r.base_used = 2 AND r.topup_balance = 0,
    format('empty balance returned %s used %s topup %s', r.outcome, r.base_used, r.topup_balance)
  );
  SELECT topup_used INTO n FROM public.tenant_ai_session_quota WHERE tenant_id = v_a;
  PERFORM pg_temp.quota_assert(n = 5, format('topup_used after spending 5 topup is %s', n));
  SELECT count(*) INTO n FROM public.ai_session_events
  WHERE tenant_id = v_a AND event_id LIKE 'direct:%' AND op = 'set_base' AND outcome = 'applied';
  PERFORM pg_temp.quota_assert(n = 1, format('direct set_base stored %s rows', n));
  SELECT count(*) INTO n FROM public.ai_session_events
  WHERE tenant_id = v_a AND event_id LIKE 'direct:%' AND op = 'add_topup' AND delta = 5;
  PERFORM pg_temp.quota_assert(n = 1, format('direct add_topup stored %s rows', n));
  SELECT count(*), sum(delta) INTO n, m FROM public.ai_session_events
  WHERE tenant_id = v_a AND event_id LIKE 'direct:%' AND op = 'consume';
  PERFORM pg_temp.quota_assert(n = 7 AND m = -7, format('direct consumes stored %s rows delta %s', n, m));

  SELECT * INTO r FROM public.consume_ai_session_event('NOBODY', 'mb1312-unknown');
  PERFORM pg_temp.quota_assert(
    r.outcome = 'company_code_not_found',
    format('unknown company returned %s', r.outcome)
  );

  BEGIN
    PERFORM public.consume_ai_session_event('MB1312QA', '   ');
    PERFORM pg_temp.quota_assert(false, 'blank event_id was accepted');
  EXCEPTION
    WHEN sqlstate '22023' THEN
      NULL;
  END;

  SELECT * INTO r FROM public.consume_ai_session_event('MB1312QB', 'mb1312-none');
  PERFORM pg_temp.quota_assert(
    r.outcome = 'not_provisioned',
    format('unprovisioned returned %s', r.outcome)
  );
  SELECT count(*) INTO n FROM public.ai_session_events WHERE op = 'consume' AND outcome = 'applied' AND event_id = 'mb1312-none';
  PERFORM pg_temp.quota_assert(n = 0, 'not_provisioned counted as applied');

  PERFORM public.set_ai_session_base(v_b, 0);
  SELECT * INTO r FROM public.consume_ai_session_event('MB1312QB', 'mb1312-empty');
  PERFORM pg_temp.quota_assert(r.outcome = 'exhausted', format('empty event returned %s', r.outcome));
  SELECT count(*) INTO n FROM public.ai_session_events WHERE op = 'consume' AND outcome = 'applied' AND event_id = 'mb1312-empty';
  PERFORM pg_temp.quota_assert(n = 0, 'exhausted counted as applied');

  PERFORM public.set_ai_session_base(v_b, 1);
  SELECT * INTO r FROM public.consume_ai_session_event('MB1312QB', 'mb1312-empty');
  PERFORM pg_temp.quota_assert(
    r.outcome = 'applied' AND r.base_used = 1 AND r.topup_balance = 0,
    format('retry after release returned %s used %s topup %s', r.outcome, r.base_used, r.topup_balance)
  );
  SELECT * INTO r FROM public.consume_ai_session_event('MB1312QB', 'mb1312-empty');
  PERFORM pg_temp.quota_assert(
    r.outcome = 'replayed' AND r.base_used = 1,
    format('replay changed the balance: %s used %s', r.outcome, r.base_used)
  );
  SELECT count(*), sum(delta) INTO n, m FROM public.ai_session_events WHERE op = 'consume' AND event_id = 'mb1312-empty';
  PERFORM pg_temp.quota_assert(n = 3 AND m = -1, format('consume history rows %s delta sum %s', n, m));

  SELECT * INTO r FROM public.consume_ai_session_event('MB1312QA', 'mb1312-empty');
  PERFORM pg_temp.quota_assert(
    r.outcome = 'event_id_conflict',
    format('cross-tenant event returned %s', r.outcome)
  );
  SELECT base_used INTO n FROM public.tenant_ai_session_quota WHERE tenant_id = v_b;
  PERFORM pg_temp.quota_assert(n = 1, format('conflict changed the first tenant used to %s', n));
  SELECT count(*) INTO n FROM public.ai_session_events
  WHERE event_id = 'mb1312-empty' AND tenant_id = v_a AND outcome = 'event_id_conflict' AND delta = 0;
  PERFORM pg_temp.quota_assert(n = 1, format('cross-tenant conflict stored %s rows for the caller', n));

  SELECT * INTO r FROM public.apply_partner_ai_session_op('MB1312QA', 'add_topup', 100, 'mb1312-topup', NULL, NULL);
  PERFORM pg_temp.quota_assert(
    r.outcome = 'applied' AND r.topup_balance = 100,
    format('first topup returned %s topup %s', r.outcome, r.topup_balance)
  );
  SELECT count(*) INTO n FROM public.ai_session_events WHERE event_id = 'mb1312-topup';
  PERFORM pg_temp.quota_assert(n = 1, format('first topup stored %s rows', n));
  SELECT count(*) INTO n FROM public.ai_session_events
  WHERE tenant_id = v_a AND event_id LIKE 'direct:%' AND op = 'add_topup';
  PERFORM pg_temp.quota_assert(n = 1, format('partner topup was also stored as %s direct rows', n));
  SELECT * INTO r FROM public.ai_session_events WHERE event_id = 'mb1312-topup';
  PERFORM pg_temp.quota_assert(
    r.tenant_id = v_a AND r.op = 'add_topup' AND r.amount = 100 AND r.delta = 100
      AND r.topup_balance = 100 AND r.remaining = 100,
    format('first topup row %s amount %s delta %s topup %s remaining %s', r.op, r.amount, r.delta, r.topup_balance, r.remaining)
  );

  SELECT * INTO r FROM public.apply_partner_ai_session_op('MB1312QA', 'add_topup', 100, 'mb1312-topup', NULL, NULL);
  PERFORM pg_temp.quota_assert(
    r.outcome = 'replayed' AND r.topup_balance = 100,
    format('repeated topup returned %s topup %s', r.outcome, r.topup_balance)
  );
  SELECT count(*) INTO n FROM public.ai_session_events WHERE event_id = 'mb1312-topup';
  PERFORM pg_temp.quota_assert(n = 2, format('repeated topup left %s rows', n));
  SELECT count(*) INTO n FROM public.ai_session_events
  WHERE event_id = 'mb1312-topup' AND delta = 0 AND remaining = 100;
  PERFORM pg_temp.quota_assert(n = 1, format('repeated topup stored %s zero-delta rows', n));
  SELECT topup_balance INTO n FROM public.tenant_ai_session_quota WHERE tenant_id = v_a;
  PERFORM pg_temp.quota_assert(n = 100, format('repeated topup changed topup to %s', n));

  SELECT * INTO r FROM public.apply_partner_ai_session_op('MB1312QA', 'set_base', 100, 'mb1312-topup', NULL, NULL);
  PERFORM pg_temp.quota_assert(
    r.outcome = 'event_id_conflict' AND r.topup_balance = 0,
    format('conflicting op returned %s topup %s', r.outcome, r.topup_balance)
  );
  SELECT topup_balance INTO n FROM public.tenant_ai_session_quota WHERE tenant_id = v_a;
  PERFORM pg_temp.quota_assert(n = 100, format('conflicting op changed topup to %s', n));
  SELECT count(*) INTO n FROM public.ai_session_events WHERE event_id = 'mb1312-topup';
  PERFORM pg_temp.quota_assert(n = 3, format('conflicting op left %s rows', n));
  SELECT count(*) INTO n FROM public.ai_session_events
  WHERE event_id = 'mb1312-topup' AND outcome = 'event_id_conflict' AND op = 'set_base' AND amount = 100 AND delta = 0;
  PERFORM pg_temp.quota_assert(n = 1, format('conflicting op stored %s conflict rows', n));

  SELECT * INTO r FROM public.apply_partner_ai_session_op('MB1312QA', 'set_base', 9, 'mb1312-base', NULL, NULL);
  PERFORM pg_temp.quota_assert(
    r.outcome = 'applied' AND r.base_limit = 9 AND r.base_used = 2 AND r.topup_balance = 100,
    format('set_base returned %s limit %s used %s topup %s', r.outcome, r.base_limit, r.base_used, r.topup_balance)
  );
  SELECT * INTO r FROM public.ai_session_events WHERE event_id = 'mb1312-base';
  PERFORM pg_temp.quota_assert(
    r.op = 'set_base' AND r.amount = 9 AND r.delta = 7 AND r.base_limit = 9 AND r.base_used = 2
      AND r.topup_balance = 100 AND r.remaining = 107,
    format('set_base row %s amount %s delta %s limit %s used %s topup %s remaining %s',
      r.op, r.amount, r.delta, r.base_limit, r.base_used, r.topup_balance, r.remaining)
  );

  UPDATE public.tenant_ai_session_quota SET base_used = 4 WHERE tenant_id = v_a;
  SELECT * INTO r FROM public.apply_partner_ai_session_op('MB1312QA', 'reset_base', NULL, 'mb1312-reset', NULL, NULL);
  PERFORM pg_temp.quota_assert(
    r.outcome = 'applied' AND r.base_used = 0 AND r.base_limit = 9 AND r.topup_balance = 100,
    format('reset without amount returned %s limit %s used %s topup %s', r.outcome, r.base_limit, r.base_used, r.topup_balance)
  );
  SELECT * INTO r FROM public.ai_session_events WHERE event_id = 'mb1312-reset';
  PERFORM pg_temp.quota_assert(
    r.op = 'reset_base' AND r.amount IS NULL AND r.delta = 4 AND r.base_used = 0 AND r.base_limit = 9
      AND r.remaining = 109,
    format('reset row amount %s delta %s limit %s used %s remaining %s', r.amount, r.delta, r.base_limit, r.base_used, r.remaining)
  );

  UPDATE public.tenant_ai_session_quota SET base_used = 3 WHERE tenant_id = v_a;
  SELECT * INTO r FROM public.apply_partner_ai_session_op('MB1312QA', 'reset_base', 4, 'mb1312-reset-limit', NULL, NULL);
  PERFORM pg_temp.quota_assert(
    r.outcome = 'applied' AND r.base_used = 0 AND r.base_limit = 4 AND r.topup_balance = 100,
    format('reset with amount returned %s limit %s used %s topup %s', r.outcome, r.base_limit, r.base_used, r.topup_balance)
  );
  SELECT * INTO r FROM public.ai_session_events WHERE event_id = 'mb1312-reset-limit';
  PERFORM pg_temp.quota_assert(
    r.op = 'reset_base' AND r.amount = 4 AND r.delta = -2 AND r.base_limit = 4 AND r.base_used = 0
      AND r.remaining = 104,
    format('reset limit row amount %s delta %s limit %s used %s remaining %s', r.amount, r.delta, r.base_limit, r.base_used, r.remaining)
  );

  INSERT INTO public.ai_session_events (event_id, tenant_id, op, outcome, amount, delta, base_limit, base_used, topup_balance, topup_used)
  VALUES ('mb1312-multi', v_a, 'add_topup', 'applied', 1, 1, 0, 0, 1, 0);
  INSERT INTO public.ai_session_events (event_id, tenant_id, op, outcome, amount, delta, base_limit, base_used, topup_balance, topup_used)
  VALUES ('mb1312-multi', v_a, 'add_topup', 'replayed', 1, 0, 0, 0, 1, 0);
  SELECT count(*) INTO n FROM public.ai_session_events WHERE event_id = 'mb1312-multi';
  PERFORM pg_temp.quota_assert(n = 2, format('repeated event_id kept %s rows', n));
END;
$integration$;

ROLLBACK;
