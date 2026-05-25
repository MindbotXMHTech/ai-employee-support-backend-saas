@AGENTS.md

# Claude-Specific Notes

Use `AGENTS.md` as the source of truth for this project. This file exists so Claude-based agents load the same project context.

When working in this repository:

- Treat `README.md` as the external team handoff document.
- Treat `AGENTS.md` as the internal agent operating guide.
- Keep `CLAUDE.md` short and aligned with `AGENTS.md`; do not duplicate large documentation unless needed.
- This is a central LINE bot / multi-tenant backend. Do not reintroduce per-tenant bot integration as the primary design.
- AI settings are per tenant but editable only by Platform Admin.
- Company Admin must not be given access to model selection or system instructions.
- RAG documents can be managed by Platform Admin for any tenant and by Company Admin for their own tenant.
- Always preserve tenant isolation and server-side tenant resolution.
- For Supabase work, read the Supabase skill/instructions first and verify migrations with `supabase db push --dry-run` before pushing.
- For Next.js code, remember this project uses Next.js 16. Read relevant docs in `node_modules/next/dist/docs/` if API behavior is uncertain.

## Mindbloom partner sync

**Mindbloom is source of truth for plan/status; this service is quota runtime only** for companies provisioned via Super Admin / partner API.

| Partner endpoint | Body |
|------------------|-------------------------------|
| `POST /api/v1/partner/tenants` | `{ company_code, name, quota, admin_email, admin_display_name }` — **no `plan`**, no SaaS Auth user, no `temporaryPassword` in response |
| `POST /api/v1/partner/tenants/sync-plan` | `{ company_code, quota, event_id, occurred_at?, updated_by? }` — **no `plan`/`status`** |

Implementation: `src/lib/validation/partnerProvision.ts`, `createPartnerTenantOnboarding()` and `syncTenantPlanFromPartner()` in `src/lib/services/tenantService.ts`, `deriveTenantStatusFromQuota()`.

- **`monthly_message_limit = quota`**; **`status = quota > 0 ? active : suspended`**
- Chat: `enforceTenantAvailability()` blocks when `monthly_message_limit <= 0` (not plan-based trial expiry for partner tenants)
- **`downgradeExpiredTrialTenantsToFree`** skips partner-provisioned tenants (audit `tenant.onboarded` + `partner_company_code`)
- **Platform Admin Tenant Controls** (`tenant-management-form.tsx`): name/plan/status/message limit read-only; `PATCH /api/admin/tenants/[id]` rejects those fields with 403
- Partner routes rate-limited per IP + `company_code` (`src/lib/api/partnerRateLimit.ts`)

**Local dev with Mindbloom Edge (Docker):** Mindbloom sets `PARTNER_TENANT_API_URL=http://host.docker.internal:3001/api/v1/partner/tenants`. This repo needs `TENANT_PROVISION_SECRET` in `.env` / `.env.local` and **`supabase db push`** so `public.tenants` exists. Run `npm run dev:local` or `npm run dev -- -p 3001`.

**Deploy with Mindbloom MB-882** — if production still validates `plan` on partner APIs, Mindbloom create/update sync will fail with `VALIDATION_ERROR`.
