# set_ai_session_base

## Purpose

`public.set_ai_session_base` sets `base_limit` for one tenant. It does not assign `base_used` or `topup_balance`.

## Parameters

| Name | Type | Condition | Meaning |
| --- | --- | --- | --- |
| `tenant_id` | `uuid` | Null raises SQLSTATE `22023` with message `tenant_id is required`. | The tenant whose base ceiling to set. |
| `new_base_limit` | `integer` | Null, or a value below `0`, raises SQLSTATE `22023` with message `base_limit must be >= 0`. | The new `base_limit`. The name is `new_base_limit` so it does not clash with the output column `base_limit`. |

## Return value

The function returns the stored row after the insert or the conflict action.

| Column | Type | Meaning |
| --- | --- | --- |
| `base_limit` | `integer` | Stored base ceiling. |
| `base_used` | `integer` | Stored base usage. Unchanged on conflict. `0` when this call inserted the row. |
| `topup_balance` | `integer` | Stored topup. Unchanged on conflict. `0` when this call inserted the row. |
| `updated_at` | `timestamptz` | Stored `updated_at`. Unchanged when the limit is already equal. |

`src/lib/repositories/aiSessionQuotaRepository.ts` exports `setBase`. The call uses `tenant_id` and `new_base_limit`. No other application file calls `setBase`.

## Data read and written

The insert writes `tenant_id` and `base_limit`. `base_used` and `topup_balance` use their defaults, which are `0`, only on that insert.

On conflict on `tenant_ai_session_quota_pkey`, the update sets `base_limit` to `excluded.base_limit` only when `q.base_limit is distinct from excluded.base_limit`.

The update does not assign `base_used` or `topup_balance`.

The function then selects the four return columns.

A real update fires `set_tenant_ai_session_quota_updated_at`, which sets `updated_at` to `now()` through `private.set_updated_at()`.

## Behavior

### Normal case

A missing row is inserted with the given `base_limit`, `base_used` `0`, and `topup_balance` `0`.

An existing row with a different `base_limit` stores the new limit and keeps `base_used` and `topup_balance`.

### Edge cases

The same `base_limit` again does not update. `updated_at` stays put.

`base_used` may remain above the new `base_limit`. The table check requires `base_used >= 0`, not `base_used <= base_limit`. The migration comment says availability clamps that case. The clamp is not in this function. `src/lib/domain/aiSessionQuota.ts` `computeSessionAvailability` uses `max(base_limit - base_used, 0)` for the base remainder and leaves `topup_balance` as it is. This RPC does not call that function.

`new_base_limit` `0` is allowed.

### Errors

Null `tenant_id` raises SQLSTATE `22023` and message `tenant_id is required`.

Null or negative `new_base_limit` raises SQLSTATE `22023` and message `base_limit must be >= 0`.

A `tenant_id` that is not in `public.tenants` fails the foreign key on insert. The function does not catch that failure. ยังไม่พบข้อมูลยืนยัน of the SQLSTATE text inside this function.

## Repeated calls

Calling again with the same `new_base_limit` does not write. The counters stay the same.

Calling again with a different non-negative limit changes `base_limit` only.

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
| 2026-10-28 | [`da2e95ae6734a415717c5f58781b5af82143af4b`](https://github.com/MindbotXMHTech/ai-employee-support-backend-saas/commit/da2e95ae6734a415717c5f58781b5af82143af4b) | Add the RPC that sets `base_limit`. |
