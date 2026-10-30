# is_platform_admin

## Purpose

`public.is_platform_admin` reports whether `auth.uid()` matches a `public.users` row with `role` equal to `platform_admin`.

## Parameters

This function has no parameters.

## Return value

The function returns `boolean`.

The body is an `exists` query. `exists` returns true or false. It does not return null when the subquery is empty.

## Data read and written

The function reads `public.users` (`auth_user_id`, `role`).

The function writes nothing.

Row level security policies call it from these migrations.

- `supabase/migrations/0001_initial_schema.sql`
- `supabase/migrations/0002_central_bot_mode.sql`
- `supabase/migrations/0005_tenant_ai_settings.sql`
- `supabase/migrations/0006_workflow_tokens.sql`

No TypeScript file in this repository calls it through `.rpc(`.

## Behavior

### Normal case

The function returns true when the current `auth.uid()` has a `public.users` row whose `role` is `platform_admin`.

The function returns false when no such row exists.

### Edge cases

`auth.uid()` null makes the `auth_user_id` comparison fail. The function returns false.

`public.users.role` cannot be stored as any value other than `platform_admin` or `tenant_admin`. A `tenant_admin` row does not make this function return true.

### Errors

The function body contains no `raise`. The migration does not name an error for this function.

## Repeated calls

The function is `stable` and writes nothing. A repeated call in the same snapshot returns the same boolean. It does not record that it ran.

## Transaction and concurrency

The function body has no `begin`, `commit`, or row lock. A later transaction can change `public.users.role` and change the next result.

## Privileges and security

The migration declares `language sql`, `stable`, `security definer`, and `set search_path = public`.

The migration does not name the function owner. ยังไม่พบข้อมูลยืนยัน of the owner role.

`supabase/migrations` contains no `grant` and no `revoke` for this function. ยังไม่พบข้อมูลยืนยัน of the effective `EXECUTE` list.

Policies in the migrations above call the function in `using` and `with check` expressions. Those policies do not change the function body.

## Source

`supabase/migrations/0001_initial_schema.sql` defines the function. No later migration in this repository replaces it.

## Change history

| Date | Commit | Details |
|---|---|---|
| 2026-05-07 | [`24df07f8e77d7cb0ab4a7b2184bd8602725c833b`](https://github.com/MindbotXMHTech/ai-employee-support-backend-saas/commit/24df07f8e77d7cb0ab4a7b2184bd8602725c833b) | Add the RPC that reports whether the current user is a `platform_admin`. |
