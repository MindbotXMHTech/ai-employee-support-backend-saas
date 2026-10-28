# upsert_ai_session_quota

## Purpose

`public.upsert_ai_session_quota` inserts a zero session row when the tenant has none. When the row already exists, it leaves the counters and `updated_at` unchanged.

## Parameters

| Name | Type | Condition | Meaning |
| --- | --- | --- | --- |
| `tenant_id` | `uuid` | Null raises SQLSTATE `22023` with message `tenant_id is required`. | The tenant that should have a session row. |

The function does not accept `base_limit`, `base_used`, or `topup_balance`. A new row uses the column defaults, which are `0`.

## Return value

The function returns one table row after the insert attempt.

| Column | Type | Meaning |
| --- | --- | --- |
| `base_limit` | `integer` | Stored base ceiling. `0` on a new row. |
| `base_used` | `integer` | Stored base sessions already spent. `0` on a new row. |
| `topup_balance` | `integer` | Stored topup sessions. `0` on a new row. |
| `updated_at` | `timestamptz` | Stored `updated_at`. A new row uses `now()`. An existing row keeps its value. |

`src/lib/services/tenantService.ts` calls this through `upsertQuota` inside `createPartnerTenantOnboarding`. The call passes only `tenant.id`. It runs after the `public.tenants` insert succeeds and before the `public.tenant_profiles` insert. `input.quota` is still written to `public.tenants.monthly_message_limit` by `buildPartnerTenantInsertRow`. This function does not read that column.

`src/app/api/v1/partner/tenants/route.ts` is the HTTP entry that calls `createPartnerTenantOnboarding`.

## Data read and written

The function inserts into `public.tenant_ai_session_quota` with only `tenant_id`.

`on conflict on constraint tenant_ai_session_quota_pkey do nothing` leaves an existing row unchanged. The conflict target is the primary key, not the bare column name `tenant_id`, because the argument has the same name.

The function then selects `base_limit`, `base_used`, `topup_balance`, and `updated_at` for that tenant.

It does not assign `base_used` or `topup_balance` on conflict.

## Behavior

### Normal case

The first call for a tenant inserts `base_limit` `0`, `base_used` `0`, and `topup_balance` `0`, then returns that row.

A later call returns the stored row and does not reset those counters.

### Edge cases

`tenant_id` must exist in `public.tenants` because `tenant_ai_session_quota.tenant_id` references `public.tenants(id)` `on delete cascade`. The function does not catch a foreign-key failure. ยังไม่พบข้อมูลยืนยัน of the SQLSTATE text inside this function. The constraint is the source of the failure.

Deleting the tenant deletes the session row through that foreign key. This function does not delete.

### Errors

Null `tenant_id` raises SQLSTATE `22023` and message `tenant_id is required`.

## Repeated calls

A second call is a no-op write. `on conflict do nothing` does not update the row, so the `before update` trigger does not change `updated_at`.

This is idempotent for the zero-row create. It is not a way to set a new limit or to add topup. A second call does not remove usage that another function stored.

## Transaction and concurrency

The function body has no `begin`, `commit`, or `for update`.

Two first inserts for the same `tenant_id` conflict on `tenant_ai_session_quota_pkey`. One insert stores the zero row. The other does nothing. Both selects then return that row.

`consume_ai_session` locks an existing row with `for update`. This function's conflict clause is `do nothing` and the body contains no `for update`. ยังไม่พบข้อมูลยืนยัน of which call wins when the two run together on a row that already exists.

## Privileges and security

The migration declares `language plpgsql`, `volatile`, `security definer`, and `set search_path = ''`.

The migration does not name the function owner. ยังไม่พบข้อมูลยืนยัน of the owner role.

`supabase/migrations/0008_tenant_ai_session_quota.sql` revokes all privileges on this function from `public`, `anon`, and `authenticated`, then grants `execute` to `service_role`.

The same migration enables row level security on the table, creates no policy, and revokes all table privileges from `public`, `anon`, `authenticated`, and `service_role`. Direct table writes from `service_role` are revoked. This function is `security definer`, so its insert runs as the function owner.

## Source

`supabase/migrations/0008_tenant_ai_session_quota.sql` defines the function. No later migration in this repository replaces it.

## Change history

| Date | Commit | Details |
|---|---|---|
| 2026-10-28 | [`da2e95ae6734a415717c5f58781b5af82143af4b`](https://github.com/MindbotXMHTech/ai-employee-support-backend-saas/commit/da2e95ae6734a415717c5f58781b5af82143af4b) | Add the RPC that inserts a zero session row. |
