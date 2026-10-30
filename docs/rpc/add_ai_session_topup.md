# add_ai_session_topup

## Purpose

`public.add_ai_session_topup` adds `amount` to `topup_balance`. It does not assign `base_limit` or `base_used`.

## Parameters

| Name | Type | Condition | Meaning |
| --- | --- | --- | --- |
| `tenant_id` | `uuid` | Null raises SQLSTATE `22023` with message `tenant_id is required`. | The tenant whose topup to increase. |
| `amount` | `integer` | Null, or a value below `1`, raises SQLSTATE `22023` with message `topup amount must be >= 1`. | The amount to add. Every accepted call adds this amount again. |

## Return value

The function returns the stored row after the insert or the add.

| Column | Type | Meaning |
| --- | --- | --- |
| `base_limit` | `integer` | Stored base ceiling. `0` when this call inserted the row. Unchanged on conflict. |
| `base_used` | `integer` | Stored base usage. `0` when this call inserted the row. Unchanged on conflict. |
| `topup_balance` | `integer` | Stored topup after the add. |
| `updated_at` | `timestamptz` | Stored `updated_at`. A conflict update changes it through the `before update` trigger. |

`src/lib/repositories/aiSessionQuotaRepository.ts` exports `addTopup`. The call uses `tenant_id` and `amount`. No other application file calls `addTopup`.

## Data read and written

The insert writes `tenant_id` and `topup_balance`. On a new row, `base_limit` and `base_used` use their defaults, which are `0`.

On conflict on `tenant_ai_session_quota_pkey`, the update sets `topup_balance` to `q.topup_balance + excluded.topup_balance`.

The update does not assign `base_limit` or `base_used`.

The conflict update fires `set_tenant_ai_session_quota_updated_at`, which sets `updated_at` to `now()`.

## Behavior

### Normal case

A missing row is inserted with `topup_balance` equal to `amount`, `base_limit` `0`, and `base_used` `0`.

An existing row increases `topup_balance` by `amount`.

### Edge cases

`amount` `1` is the smallest accepted value.

The migration comment says integer overflow raises `22003` and that the function must not clamp. The function body does not contain that `raise`. The sum is a PostgreSQL `integer` addition. ยังไม่พบข้อมูลยืนยัน of a repository test that forces the overflow.

The table check requires `topup_balance >= 0`. An accepted `amount` is at least `1`, so this function does not decrease topup.

### Errors

Null `tenant_id` raises SQLSTATE `22023` and message `tenant_id is required`.

Null or non-positive `amount` raises SQLSTATE `22023` and message `topup amount must be >= 1`.

A `tenant_id` that is not in `public.tenants` fails the foreign key on insert. The function does not catch that failure. ยังไม่พบข้อมูลยืนยัน of the SQLSTATE text inside this function.

## Repeated calls

A second call adds `amount` again. The migration comment says retry identity belongs to the caller. This function has no idempotency key.

## Transaction and concurrency

The function body has no `begin`, `commit`, or `for update`.

On conflict, the assigned value is `q.topup_balance + excluded.topup_balance`. ยังไม่พบข้อมูลยืนยัน of a test in this repository that runs two adds at the same time.

## Privileges and security

The migration declares `language plpgsql`, `volatile`, `security definer`, and `set search_path = ''`.

The migration does not name the function owner. ยังไม่พบข้อมูลยืนยัน of the owner role.

`supabase/migrations/0008_tenant_ai_session_quota.sql` revokes all privileges on this function from `public`, `anon`, and `authenticated`, then grants `execute` to `service_role`.

The same migration enables row level security on the table, creates no policy, and revokes all table privileges from `public`, `anon`, `authenticated`, and `service_role`.

## Source

`supabase/migrations/0008_tenant_ai_session_quota.sql` defines the function. No later migration in this repository replaces it.

## Change history

| Date | Commit | Details |
|---|---|---|
| 2026-10-28 | [`da2e95ae6734a415717c5f58781b5af82143af4b`](https://github.com/MindbotXMHTech/ai-employee-support-backend-saas/commit/da2e95ae6734a415717c5f58781b5af82143af4b) | Add the RPC that adds credit. |
