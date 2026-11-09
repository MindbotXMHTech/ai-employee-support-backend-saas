-- Nine overlapping spends must not oversell a base of 5 plus a topup of 3.
-- Two overlapping add_topup calls with one event_id add 100 once.
-- Fixtures are committed so the other sessions can see them.
-- Run: npm run test:integration

\set AUTOCOMMIT on

CREATE EXTENSION IF NOT EXISTS dblink;

CREATE OR REPLACE FUNCTION pg_temp.quota_race_assert(p_ok boolean, p_msg text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT p_ok THEN
    RAISE EXCEPTION 'ai_session_quota concurrency failed: %', p_msg;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.quota_race_conn()
RETURNS text
LANGUAGE sql
AS $$
  SELECT format(
    'host=%s port=5432 dbname=%s user=postgres password=postgres',
    COALESCE(host(inet_server_addr()), '127.0.0.1'),
    current_database()
  );
$$;

CREATE OR REPLACE FUNCTION pg_temp.quota_race_cleanup()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant uuid := '13120000-0000-4000-8000-0000000000c1';
BEGIN
  DELETE FROM public.audit_logs WHERE tenant_id = v_tenant;
  DELETE FROM public.tenants WHERE id = v_tenant;
END;
$$;

SELECT pg_temp.quota_race_cleanup();

INSERT INTO public.tenants (id, name, slug, plan, status)
VALUES (
  '13120000-0000-4000-8000-0000000000c1',
  'MB1312 race',
  'mb1312-race',
  'trial',
  'active'
);

INSERT INTO public.tenant_company_codes (tenant_id, code, status)
VALUES ('13120000-0000-4000-8000-0000000000c1', 'MB1312RC', 'active');

SELECT public.set_ai_session_base('13120000-0000-4000-8000-0000000000c1', 5);
SELECT public.add_ai_session_topup('13120000-0000-4000-8000-0000000000c1', 3);

DO $spend$
DECLARE
  v_conn text := pg_temp.quota_race_conn();
  v_tenant uuid := '13120000-0000-4000-8000-0000000000c1';
  v_sql text := format('SELECT outcome::text FROM public.consume_ai_session(%L::uuid)', v_tenant);
  v_name text;
  v_outcome text;
  v_base integer := 0;
  v_topup integer := 0;
  v_exhausted integer := 0;
  v_other text := '';
  i integer;
  q record;
BEGIN
  FOR i IN 1..9 LOOP
    v_name := 'spend' || i;
    PERFORM dblink_connect(v_name, v_conn);
  END LOOP;

  BEGIN
    FOR i IN 1..9 LOOP
      PERFORM dblink_send_query('spend' || i, v_sql);
    END LOOP;

    FOR i IN 1..9 LOOP
      SELECT t.outcome INTO v_outcome
      FROM dblink_get_result('spend' || i) AS t(outcome text);
      IF v_outcome = 'consumed_base' THEN
        v_base := v_base + 1;
      ELSIF v_outcome = 'consumed_topup' THEN
        v_topup := v_topup + 1;
      ELSIF v_outcome = 'exhausted' THEN
        v_exhausted := v_exhausted + 1;
      ELSE
        v_other := v_other || coalesce(v_outcome, 'null') || ' ';
      END IF;
      BEGIN
        PERFORM 1 FROM dblink_get_result('spend' || i) AS t(outcome text);
      EXCEPTION
        WHEN OTHERS THEN
          NULL;
      END;
    END LOOP;
  EXCEPTION
    WHEN OTHERS THEN
      FOR i IN 1..9 LOOP
        BEGIN
          PERFORM dblink_disconnect('spend' || i);
        EXCEPTION
          WHEN OTHERS THEN
            NULL;
        END;
      END LOOP;
      PERFORM pg_temp.quota_race_cleanup();
      RAISE;
  END;

  FOR i IN 1..9 LOOP
    PERFORM dblink_disconnect('spend' || i);
  END LOOP;

  BEGIN
    SELECT base_used, topup_balance INTO q
    FROM public.tenant_ai_session_quota
    WHERE tenant_id = v_tenant;

    PERFORM pg_temp.quota_race_assert(
      v_base = 5 AND v_topup = 3 AND v_exhausted = 1 AND v_other = '',
      format('nine spends returned base %s topup %s exhausted %s other %s', v_base, v_topup, v_exhausted, v_other)
    );
    PERFORM pg_temp.quota_race_assert(
      q.base_used = 5 AND q.topup_balance = 0,
      format('row after nine spends is used %s topup %s', q.base_used, q.topup_balance)
    );
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM pg_temp.quota_race_cleanup();
      RAISE;
  END;
END;
$spend$;

DO $topup$
DECLARE
  v_conn text := pg_temp.quota_race_conn();
  v_sql text := $q$
    SELECT outcome::text || ' ' || topup_balance::text
    FROM public.apply_partner_ai_session_op('MB1312RC', 'add_topup', 100, 'mb1312-race-topup', NULL, NULL)
  $q$;
  v_a text;
  v_b text;
  q record;
BEGIN
  PERFORM dblink_connect('topup_a', v_conn);
  PERFORM dblink_connect('topup_b', v_conn);

  BEGIN
    PERFORM dblink_send_query('topup_a', v_sql);
    PERFORM dblink_send_query('topup_b', v_sql);
    SELECT t.payload INTO v_a FROM dblink_get_result('topup_a') AS t(payload text);
    SELECT t.payload INTO v_b FROM dblink_get_result('topup_b') AS t(payload text);
  EXCEPTION
    WHEN OTHERS THEN
      BEGIN
        PERFORM dblink_disconnect('topup_a');
      EXCEPTION
        WHEN OTHERS THEN
          NULL;
      END;
      BEGIN
        PERFORM dblink_disconnect('topup_b');
      EXCEPTION
        WHEN OTHERS THEN
          NULL;
      END;
      PERFORM pg_temp.quota_race_cleanup();
      RAISE;
  END;

  PERFORM dblink_disconnect('topup_a');
  PERFORM dblink_disconnect('topup_b');

  BEGIN
    SELECT base_used, topup_balance INTO q
    FROM public.tenant_ai_session_quota
    WHERE tenant_id = '13120000-0000-4000-8000-0000000000c1';

    PERFORM pg_temp.quota_race_assert(
      (v_a = 'applied 100' AND v_b = 'replayed 100')
        OR (v_a = 'replayed 100' AND v_b = 'applied 100'),
      format('duplicate topup returned %s and %s', v_a, v_b)
    );
    PERFORM pg_temp.quota_race_assert(
      q.base_used = 5 AND q.topup_balance = 100,
      format('row after duplicate topup is used %s topup %s', q.base_used, q.topup_balance)
    );
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM pg_temp.quota_race_cleanup();
      RAISE;
  END;
END;
$topup$;

SELECT pg_temp.quota_race_cleanup();
