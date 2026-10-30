# is_tenant_admin

## Purpose

`public.is_tenant_admin` reports whether `auth.uid()` is an active `tenant_admin` member of `target_tenant_id`.

## Parameters

| Name | Type | Condition | Meaning |
| --- | --- | --- | --- |
| `target_tenant_id` | `uuid` | None in the function body. | The tenant to test. The body compares it to `public.tenant_members.tenant_id`. |

The function has no default for `target_tenant_id`.

## Return value

The function returns `boolean`.

The body is an `exists` query. An empty match returns false.

## Data read and written

The function reads `public.tenant_members` and `public.users`.

The join is `public.users.id = public.tenant_members.user_id`. The match also requires all of the following.

- `public.users.auth_user_id` equals `auth.uid()`
- `public.tenant_members.tenant_id` equals `target_tenant_id`
- `public.tenant_members.role` equals `tenant_admin`
- `public.tenant_members.status` equals `active`

`public.tenant_members.role` is checked to `tenant_admin` only. `status` is checked to `active`, `invited`, or `disabled`. The pair `(tenant_id, user_id)` is unique.

The function writes nothing.

Row level security policies call it from these migrations.

- `supabase/migrations/0001_initial_schema.sql`
- `supabase/migrations/0002_central_bot_mode.sql`
- `supabase/migrations/0006_workflow_tokens.sql`

`0001_initial_schema.sql` also calls it from `storage.objects` policies. Those policies pass `((storage.foldername(name))[2])::uuid` as `target_tenant_id`.

No TypeScript file in this repository calls it through `.rpc(`.

## Behavior

### Normal case

The function returns true when the current user has one active `tenant_admin` membership for `target_tenant_id`.

The function returns false when that membership is missing, `invited`, or `disabled`.

### Edge cases

`auth.uid()` null fails the user match. The function returns false.

`target_tenant_id` null does not equal a `tenant_id`. The function returns false.

A `platform_admin` row in `public.users` does not by itself make this function return true. The membership predicates still have to match.

### Errors

The function body contains no `raise`. The migration does not name an error for this function.

The storage policies cast a folder name to `uuid`. That cast is outside this function. ยังไม่พบข้อมูลยืนยัน of the cast error text in this function.

## Repeated calls

The function is `stable` and writes nothing. A repeated call in the same snapshot returns the same boolean. It does not record that it ran.

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
| 2026-05-07 | [`24df07f8e77d7cb0ab4a7b2184bd8602725c833b`](https://github.com/MindbotXMHTech/ai-employee-support-backend-saas/commit/24df07f8e77d7cb0ab4a7b2184bd8602725c833b) | Add the RPC that reports whether the current user is an active `tenant_admin` of the given tenant. |
