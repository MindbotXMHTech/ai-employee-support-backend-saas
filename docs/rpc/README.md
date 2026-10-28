# RPC catalog

This page lists every function in the `public` schema that `supabase/migrations` creates in this repository. Each row links to a reference page. The pages describe the function text and the callers found in this repository.

`private.set_updated_at` is not in the list. `supabase/migrations/0001_initial_schema.sql` creates it as a `before update` trigger function. It sets `new.updated_at` to `now()` and returns `new`. No file in this repository calls it through `.rpc(`.

The search was `create or replace function` under `supabase/migrations`. That search hits `0001_initial_schema.sql` and `0008_tenant_ai_session_quota.sql` only.

## Identity and access

These functions read `public.users` and `public.tenant_members`. They do not write.

| RPC | Purpose | Data it changes | Page |
| --- | --- | --- | --- |
| `get_current_user_id` | Return `public.users.id` for `auth.uid()`. | None. | [get_current_user_id](get_current_user_id.md) |
| `get_current_user_role` | Return `public.users.role` for `auth.uid()`. | None. | [get_current_user_role](get_current_user_role.md) |
| `is_platform_admin` | Report whether the current user has role `platform_admin`. | None. | [is_platform_admin](is_platform_admin.md) |
| `is_tenant_admin` | Report whether the current user is an active `tenant_admin` of one tenant. | None. | [is_tenant_admin](is_tenant_admin.md) |
| `get_user_tenant_ids` | Return the tenant ids of the current user's active memberships. | None. | [get_user_tenant_ids](get_user_tenant_ids.md) |

## Document search

| RPC | Purpose | Data it changes | Page |
| --- | --- | --- | --- |
| `match_document_chunks` | Return the nearest ready document chunks for one tenant and one embedding. | None. | [match_document_chunks](match_document_chunks.md) |

## AI session quota

These functions use `public.tenant_ai_session_quota`. `get_ai_session_quota` only reads that table. The other five can write it. Outside the repository tests, the only caller is `createPartnerTenantOnboarding`, and that caller uses `upsert_ai_session_quota`.

| RPC | Purpose | Data it changes | Page |
| --- | --- | --- | --- |
| `get_ai_session_quota` | Read one tenant's session counters. | None. | [get_ai_session_quota](get_ai_session_quota.md) |
| `upsert_ai_session_quota` | Insert a zero session row when the tenant has none. | Inserts `public.tenant_ai_session_quota` only when the row is missing. | [upsert_ai_session_quota](upsert_ai_session_quota.md) |
| `consume_ai_session` | Spend one session from base, then from topup. | Updates `base_used` or `topup_balance` when a unit is spent. | [consume_ai_session](consume_ai_session.md) |
| `set_ai_session_base` | Set `base_limit`. | Inserts a row or updates `base_limit`. | [set_ai_session_base](set_ai_session_base.md) |
| `add_ai_session_topup` | Add a positive amount to `topup_balance`. | Inserts a row or adds to `topup_balance`. | [add_ai_session_topup](add_ai_session_topup.md) |
| `reset_ai_session_base` | Set `base_used` to 0, and set `base_limit` only when a new limit is passed. | Inserts a row or updates `base_used` and sometimes `base_limit`. | [reset_ai_session_base](reset_ai_session_base.md) |
