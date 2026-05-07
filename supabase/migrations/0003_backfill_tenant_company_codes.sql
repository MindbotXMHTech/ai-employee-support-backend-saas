insert into public.tenant_company_codes (tenant_id, code)
select
  tenants.id,
  upper(
    left(
      coalesce(nullif(regexp_replace(tenants.slug, '[^a-zA-Z0-9]', '', 'g'), ''), 'TENANT'),
      4
    ) || left(replace(tenants.id::text, '-', ''), 4)
  )
from public.tenants
where not exists (
  select 1
  from public.tenant_company_codes
  where tenant_company_codes.tenant_id = tenants.id
);
