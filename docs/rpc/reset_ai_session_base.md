# reset_ai_session_base

## Purpose

`public.reset_ai_session_base` sets `base_used` to `0`. It sets `base_limit` only when `new_base_limit` is not null. It does not assign `topup_balance`.

## Parameters

| Name | Type | Condition | Meaning |
| --- | --- | --- | --- |
| `tenant_id` | `uuid` | Null raises SQLSTATE `22023` with message `tenant_id is required`. | The tenant whose base usage to clear. |
| `new_base_limit` | `integer` | Default `null`. A non-null value below `0` raises SQLSTATE `22023` with message `base_limit must be >= 0`. | When null, keep the stored `base_limit`. When not null, store this limit. |

## Return value

The function returns the stored row after the insert or the conflict action.

| Column | Type | Meaning |
| --- | --- | --- |
| `base_limit` | `integer` | Stored base ceiling after the call. |
| `base_used` | `integer` | `0` after a write. Already `0` when the call skips the update. |
| `topup_balance` | `integer` | Stored topup. Unchanged on conflict. `0` when this call inserted the row. |
| `updated_at` | `timestamptz` | Stored `updated_at`. Unchanged when the `where` clause skips the update. |

`src/lib/repositories/aiSessionQuotaRepository.ts` exports `resetBase`. A call without a second argument sends `new_base_limit` null. A call with a number sends that number. No other application file calls `resetBase`.

## Data read and written

The insert writes `tenant_id`, `base_limit`, and `base_used`.

For a new row, `base_used` is `0` and `base_limit` is `coalesce(new_base_limit, 0)`. `topup_balance` uses its default, which is `0`.

On conflict on `tenant_ai_session_quota_pkey`, the update sets `base_used` to `0`. It sets `base_limit` to the current `q.base_limit` when `new_base_limit` is null, and to `new_base_limit` otherwise.

The update runs only when `q.base_used <> 0`, or when `new_base_limit` is not null and `q.base_limit` is distinct from `new_base_limit`.

The update list does not include `topup_balance`.

A real update fires `set_tenant_ai_session_quota_updated_at`, which sets `updated_at` to `now()`.

## Behavior

### Normal case

An existing row with `base_used` above `0` is updated to `base_used` `0`. `topup_balance` stays as stored. `base_limit` stays as stored when `new_base_limit` is null.

A non-null `new_base_limit` stores that ceiling and still sets `base_used` to `0`.

### Edge cases

When `base_used` is already `0` and `new_base_limit` is null, the `where` clause is false. The row is not updated, and `updated_at` stays put.

When `base_used` is already `0` and `new_base_limit` equals the stored `base_limit`, the `where` clause is false. The row is not updated.

A missing row is inserted with `base_used` `0`, `topup_balance` `0`, and `base_limit` `coalesce(new_base_limit, 0)`.

`new_base_limit` `0` is allowed. It is distinct from a positive stored limit, so the update runs.

### Errors

Null `tenant_id` raises SQLSTATE `22023` and message `tenant_id is required`.

A negative `new_base_limit` raises SQLSTATE `22023` and message `base_limit must be >= 0`. Null `new_base_limit` does not raise that error.

A `tenant_id` that is not in `public.tenants` fails the foreign key on insert. The function does not catch that failure. ยังไม่พบข้อมูลยืนยัน of the SQLSTATE text inside this function.

## Repeated calls

A second call with the same arguments, after `base_used` is already `0` and the limit already matches, does not write.

A second call does not subtract `topup_balance`.

This function has no idempotency key. The skip depends on the stored `base_used` and `base_limit`, not on a caller event id.

## Transaction and concurrency

The function body has no `begin`, `commit`, or `for update`.

The existing-row path is `on conflict ... do update`. ยังไม่พบข้อมูลยืนยัน in this repository of how that update is ordered against a concurrent `consume_ai_session`.

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
| 2026-10-28 | [`da2e95ae6734a415717c5f58781b5af82143af4b`](https://github.com/MindbotXMHTech/ai-employee-support-backend-saas/commit/da2e95ae6734a415717c5f58781b5af82143af4b) | Add the RPC that sets `base_used` back to 0. |
