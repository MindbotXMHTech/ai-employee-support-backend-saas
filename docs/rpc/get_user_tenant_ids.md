# get_user_tenant_ids

## Purpose

`public.get_user_tenant_ids` returns every `public.tenant_members.tenant_id` for the current user's active memberships.

## Parameters

This function has no parameters.

## Return value

The function returns `setof uuid`.

Each returned value is `public.tenant_members.tenant_id`. The query has no `order by`. ยังไม่พบข้อมูลยืนยัน of a stable row order.

When the user has no active membership, the function returns an empty set.

## Data read and written

The function reads `public.tenant_members` and `public.users`.

The join is `public.users.id = public.tenant_members.user_id`. The match requires `public.users.auth_user_id` equal to `auth.uid()` and `public.tenant_members.status` equal to `active`. The query does not filter `public.tenant_members.role`.

The function writes nothing.

No policy and no TypeScript file in this repository calls `public.get_user_tenant_ids`.

## Behavior

### Normal case

The function returns one `uuid` per active membership of the current user.

### Edge cases

`auth.uid()` null matches no user. The function returns an empty set.

A membership with status `invited` or `disabled` is omitted.

A user with two active memberships returns two tenant ids. `(tenant_id, user_id)` is unique, so the same tenant is not returned twice for one user.

### Errors

The function body contains no `raise`. The migration does not name an error for this function.

## Repeated calls

The function is `stable` and writes nothing. A repeated call in the same snapshot returns the same set. It does not record that it ran.

## Transaction and concurrency

The function body has no `begin`, `commit`, or row lock.

## Privileges and security

The migration declares `language sql`, `stable`, `security definer`, and `set search_path = public`.

The migration does not name the function owner. ยังไม่พบข้อมูลยืนยัน of the owner role.

`supabase/migrations` contains no `grant` and no `revoke` for this function. ยังไม่พบข้อมูลยืนยัน of the effective `EXECUTE` list.

## Source

`supabase/migrations/0001_initial_schema.sql` defines the function. No later migration in this repository replaces it.

## Change history

| Date | Commit | Details |
|---|---|---|
| 2026-05-07 | [`24df07f8e77d7cb0ab4a7b2184bd8602725c833b`](https://github.com/MindbotXMHTech/ai-employee-support-backend-saas/commit/24df07f8e77d7cb0ab4a7b2184bd8602725c833b) | Add the RPC that returns tenant ids for active memberships. |
