-- Local Supabase only: runs after migrations on `supabase db reset` and on first `supabase start`.
-- One platform admin for http://localhost:4000/login — see README "Local admin login (seeded)".

do $$
declare
  v_id constant uuid := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380001'::uuid;
  v_email constant text := 'platform-admin@local.dev';
  v_password constant text := 'LocalDev123!';
begin
  if exists (select 1 from public.users where role = 'platform_admin') then
    return;
  end if;

  if exists (select 1 from auth.users where id = v_id or lower(email) = lower(v_email)) then
    return;
  end if;

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change,
    email_change_token_new,
    is_sso_user,
    is_anonymous
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_id,
    'authenticated',
    'authenticated',
    v_email,
    crypt(v_password, gen_salt('bf')),
    timezone('utc', now()),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Local Platform Admin"}'::jsonb,
    timezone('utc', now()),
    timezone('utc', now()),
    '',
    '',
    '',
    '',
    false,
    false
  );

  insert into auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    v_id::text,
    v_id,
    jsonb_build_object('sub', v_id::text, 'email', v_email),
    'email',
    timezone('utc', now()),
    timezone('utc', now()),
    timezone('utc', now())
  );

  insert into public.users (id, auth_user_id, email, display_name, role)
  values (
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380002'::uuid,
    v_id,
    v_email,
    'Local Platform Admin',
    'platform_admin'
  );
end $$;
