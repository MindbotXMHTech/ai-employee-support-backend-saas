alter table public.tenants
  drop constraint if exists tenants_plan_check;

alter table public.tenants
  add constraint tenants_plan_check check (plan in ('free', 'trial', 'pro'));
