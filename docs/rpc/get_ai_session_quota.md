# get_ai_session_quota

## Purpose

`public.get_ai_session_quota` reads the session counters for one tenant. It does not create a row.

## Parameters

| Name | Type | Condition | Meaning |
| --- | --- | --- | --- |
| `tenant_id` | `uuid` | Null raises SQLSTATE `22023` with message `tenant_id is required`. | The tenant whose row to read. |

## Return value

The function returns a table.

| Column | Type | Meaning |
| --- | --- | --- |
| `base_limit` | `integer` | Stored base ceiling. |
| `base_used` | `integer` | Stored base sessions already spent. |
| `topup_balance` | `integer` | Stored topup sessions still available. |
| `updated_at` | `timestamptz` | Stored `updated_at`. |

When the tenant has no row, the function returns no row.

`src/lib/repositories/aiSessionQuotaRepository.ts` maps an empty result to `null` in `getQuota`. No other application file calls `getQuota`.

## Data read and written

The function reads `public.tenant_ai_session_quota`.

The function writes nothing.

## Behavior

### Normal case

A stored row is returned as one result row.

### Edge cases

A tenant id that is not in `public.tenants` still runs the select. The select matches nothing, so the result is empty. The function does not insert.

### Errors

Null `tenant_id` raises SQLSTATE `22023` and message `tenant_id is required`.

The function body has no other `raise`.

## Repeated calls

A second call with the same `tenant_id` reads the row again. It does not change `base_limit`, `base_used`, `topup_balance`, or `updated_at`. It does not record that it ran.

## Transaction and concurrency

The function body has no `begin`, `commit`, or `for update`.

## Privileges and security

The migration declares `language plpgsql`, `volatile`, `security definer`, and `set search_path = ''`.

The body schema-qualifies `public.tenant_ai_session_quota`.

The migration does not name the function owner. ยังไม่พบข้อมูลยืนยัน of the owner role.

`supabase/migrations/0008_tenant_ai_session_quota.sql` revokes all privileges on this function from `public`, `anon`, and `authenticated`, then grants `execute` to `service_role`.

The same migration enables row level security on `public.tenant_ai_session_quota` and creates no policy. It also revokes all table privileges from `public`, `anon`, `authenticated`, and `service_role`.

## Source

`supabase/migrations/0008_tenant_ai_session_quota.sql` defines the function. No later migration in this repository replaces it.

## Change history

| Date | Commit | Details |
|---|---|---|
| 2026-10-28 | [`da2e95ae6734a415717c5f58781b5af82143af4b`](https://github.com/MindbotXMHTech/ai-employee-support-backend-saas/commit/da2e95ae6734a415717c5f58781b5af82143af4b) | Add the RPC that reads a tenant session balance. |
