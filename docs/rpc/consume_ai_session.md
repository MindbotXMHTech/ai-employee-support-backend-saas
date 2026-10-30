# consume_ai_session

## Purpose

`public.consume_ai_session` spends one session for a tenant. It spends base while `base_used` is below `base_limit`. It then spends one topup while `topup_balance` is above `0`. Otherwise it changes nothing.

## Parameters

| Name | Type | Condition | Meaning |
| --- | --- | --- | --- |
| `tenant_id` | `uuid` | Null raises SQLSTATE `22023` with message `tenant_id is required`. | The tenant whose row to lock and spend. |

The function takes no idempotency key. The migration comment says a second call spends again.

## Return value

The function returns one table row.

| Column | Type | Meaning |
| --- | --- | --- |
| `outcome` | `public.ai_session_consume_outcome` | `consumed_base`, `consumed_topup`, or `exhausted`. The domain check allows only those three texts. |
| `base_limit` | `integer` | Base ceiling after the decision. Unchanged by this function. |
| `base_used` | `integer` | Base spent after the decision. Increased by `1` only for `consumed_base`. |
| `topup_balance` | `integer` | Topup left after the decision. Decreased by `1` only for `consumed_topup`. |

The outcome is stored in `decision` before the `update`. The function does not infer the outcome from the updated row.

A missing row returns `outcome` `exhausted`, `base_limit` `0`, `base_used` `0`, and `topup_balance` `0`.

`src/lib/repositories/aiSessionQuotaRepository.ts` exports `consumeSession`. No other application file calls it. If the client payload is null or an empty array, `consumeSession` returns exhausted zeros without a further write. The SQL function itself returns one row for a missing tenant row, including `outcome` `exhausted`.

## Data read and written

The function reads `public.tenant_ai_session_quota` with `for update`.

When the decision is `consumed_base` or `consumed_topup`, it updates that row's `base_used` and `topup_balance`. The `update` assigns both columns from the in-memory row. Only one of them changed.

When the decision is `exhausted`, it does not update.

A missing row does not insert.

The `before update` trigger `set_tenant_ai_session_quota_updated_at` calls `private.set_updated_at()`, which sets `new.updated_at` to `now()`. An exhausted decision does not fire that trigger.

Checks on the table require `base_limit`, `base_used`, and `topup_balance` to be at least `0`. This function increments `base_used` only while it is below `base_limit`, and decrements `topup_balance` only while it is above `0`.

## Behavior

### Normal case

If `base_used < base_limit`, the outcome is `consumed_base` and `base_used` becomes `base_used + 1`.

Otherwise, if `topup_balance > 0`, the outcome is `consumed_topup` and `topup_balance` becomes `topup_balance - 1`.

Otherwise the outcome is `exhausted` and the stored counters stay as they were.

`base_limit` is not changed.

### Edge cases

`base_used` can already be greater than `base_limit` after `set_ai_session_base` lowers the ceiling. This function does not increment `base_used` in that state. It spends topup when `topup_balance > 0`, and otherwise returns `exhausted`.

A missing row returns exhausted zeros and leaves the table without a row for that tenant.

`base_limit` `0` and `base_used` `0` does not satisfy `base_used < base_limit`. The function then tries topup.

### Errors

Null `tenant_id` raises SQLSTATE `22023` and message `tenant_id is required`.

The function body has no other `raise`.

## Repeated calls

A second call spends another unit when base or topup still has one. The migration comment says this function is not an idempotency key.

When the row is already exhausted, a second call returns `exhausted` and does not update.

## Transaction and concurrency

The function does not issue `begin` or `commit`. `for update` locks the existing row until the surrounding transaction ends.

The migration comment says concurrent calls block on this row lock and cannot both take the last unit. The spend decision uses the locked row. The `update` writes the counters chosen from that locked read.

A missing row has nothing to lock. Two concurrent calls on a missing row both take the not-found path and both return exhausted zeros. Neither inserts a row.

## Privileges and security

The migration declares `language plpgsql`, `volatile`, `security definer`, and `set search_path = ''`.

The migration does not name the function owner. ยังไม่พบข้อมูลยืนยัน of the owner role.

`supabase/migrations/0008_tenant_ai_session_quota.sql` revokes all privileges on this function from `public`, `anon`, and `authenticated`, then grants `execute` to `service_role`.

The same migration enables row level security on the table, creates no policy, and revokes all table privileges from `public`, `anon`, `authenticated`, and `service_role`.

## Source

`supabase/migrations/0008_tenant_ai_session_quota.sql` defines the function and the domain `public.ai_session_consume_outcome`. No later migration in this repository replaces it.

## Change history

| Date | Commit | Details |
|---|---|---|
| 2026-10-28 | [`da2e95ae6734a415717c5f58781b5af82143af4b`](https://github.com/MindbotXMHTech/ai-employee-support-backend-saas/commit/da2e95ae6734a415717c5f58781b5af82143af4b) | Add the RPC that spends one session from base, then from topup. |
