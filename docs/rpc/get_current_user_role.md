# get_current_user_role

## Purpose

`public.get_current_user_role` returns `public.users.role` for the row whose `auth_user_id` equals `auth.uid()`.

## Parameters

This function has no parameters.

## Return value

The function returns `text`.

The body is `select role from public.users where auth_user_id = auth.uid()`. `public.users.role` must be `platform_admin` or `tenant_admin` because of the column check. `auth_user_id` is `unique`, so at most one row matches.

When no row matches, the result is null.

## Data read and written

The function reads `public.users` (`role`, `auth_user_id`).

The function writes nothing.

No policy and no TypeScript file in this repository calls `public.get_current_user_role`.

## Behavior

### Normal case

A matching user row returns `platform_admin` or `tenant_admin`.

### Edge cases

`auth.uid()` null returns null.

A user row with a null `auth_user_id` does not match.

### Errors

The function body contains no `raise`. The migration does not name an error for this function.

## Repeated calls

The function is `stable` and writes nothing. A repeated call in the same snapshot returns the same text or the same null. It does not record that it ran.

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
| 2026-05-07 | [`24df07f8e77d7cb0ab4a7b2184bd8602725c833b`](https://github.com/MindbotXMHTech/ai-employee-support-backend-saas/commit/24df07f8e77d7cb0ab4a7b2184bd8602725c833b) | Add the RPC that returns `public.users.role` for `auth.uid()`. |
