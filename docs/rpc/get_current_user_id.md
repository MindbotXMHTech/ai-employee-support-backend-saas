# get_current_user_id

## Purpose

`public.get_current_user_id` returns the `public.users.id` row whose `auth_user_id` equals `auth.uid()`.

## Parameters

This function has no parameters.

## Return value

The function returns `uuid`.

The body is `select id from public.users where auth_user_id = auth.uid()`. `public.users.auth_user_id` is `unique`. At most one row can match.

When no row matches, the query returns no row. The declared return type is a single `uuid`, so the result is null.

## Data read and written

The function reads `public.users` (`id`, `auth_user_id`).

The function writes nothing.

`supabase/migrations/0001_initial_schema.sql` uses the function in the select policy `tenant admins read model pricing` on `public.model_pricing`. The policy expression is `public.is_platform_admin() or public.get_current_user_id() is not null`. No other file in this repository calls the function.

## Behavior

### Normal case

A signed-in user with a matching `public.users` row receives that row's `id`.

### Edge cases

`auth.uid()` null does not equal any `auth_user_id`. The function returns null.

A `public.users` row with a null `auth_user_id` does not match a real `auth.uid()`.

### Errors

The function body contains no `raise`. The migration does not name an error for this function.

## Repeated calls

The function is `stable` and writes nothing. A repeated call in the same snapshot returns the same `uuid` or the same null. It does not record that it ran.

## Transaction and concurrency

The function body has no `begin`, `commit`, or row lock. It reads the current snapshot of `public.users`.

## Privileges and security

The migration declares `language sql`, `stable`, `security definer`, and `set search_path = public`.

The body calls schema-qualified `auth.uid()` and reads schema-qualified `public.users`.

The migration does not name the function owner. ยังไม่พบข้อมูลยืนยัน of the owner role.

`supabase/migrations` contains no `grant` and no `revoke` for this function. ยังไม่พบข้อมูลยืนยัน of the effective `EXECUTE` list.

## Source

`supabase/migrations/0001_initial_schema.sql` defines the function. No later migration in this repository replaces it.

## Change history

| Date | Commit | Details |
|---|---|---|
| 2026-05-07 | [`24df07f8e77d7cb0ab4a7b2184bd8602725c833b`](https://github.com/MindbotXMHTech/ai-employee-support-backend-saas/commit/24df07f8e77d7cb0ab4a7b2184bd8602725c833b) | Add the RPC that returns `public.users.id` for `auth.uid()`. |
