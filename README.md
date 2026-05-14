# AI Employee Support Bot SaaS Backend

Backend SaaS platform for a central employee support chatbot that serves multiple companies (tenants). The intended integration is:

```text
LINE Bot / Existing Bot
  -> this Next.js backend
  -> tenant resolution by LINE user id + company code
  -> quota check / safety / RAG / AI orchestration
  -> OpenAI
  -> structured response back to bot
```

The chatbot is central, but all data, usage, AI settings, knowledge base documents, conversations, and employee links are tenant-scoped.

## Current Scope

Built:

- Platform Admin dashboard
- Company Admin dashboard
- Tenant onboarding and deletion
- Company code generation per tenant
- LINE user registration to tenant
- Bot-facing API v1
- Per-tenant AI settings managed by Platform Admin
- Tenant knowledge base upload/delete for RAG
- RAG document processing with embeddings
- Conversation/message logging
- Usage, quota, and estimated cost tracking
- Safety and escalation settings
- Supabase Auth, PostgreSQL, Storage, RLS, and pgvector

Not built:

- Full-featured external LINE adapter service (retries, observability, queueing)
- Chatbot UI
- Payment gateway
- Complex HRIS integration

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn-style local UI primitives
- Supabase Auth
- Supabase PostgreSQL
- Supabase Storage
- Supabase RLS
- pgvector
- OpenAI API
- Vitest

## Important Concepts

### Central Bot, Multi-Tenant Backend

There is one bot integration secret: `CENTRAL_BOT_SECRET`.

The bot should not use tenant-specific API keys in the normal LINE flow. Instead:

1. Platform Admin creates a tenant.
2. System generates a `company_code` for that tenant.
3. Employee registers from LINE using that company code.
4. Backend stores a link between `line_user_id` and `tenant_id`.
5. Future messages resolve the tenant from `external_user_id + channel`.

The legacy `x-api-key` flow still exists as fallback for older integrations, but the intended central LINE bot integration uses `x-central-bot-secret`.

### Tenant Isolation

Tenant isolation is enforced by:

- `tenant_id` on all tenant-owned tables
- Supabase RLS policies
- Server-side tenant resolution
- Server-side service role only for trusted API routes

Never accept `tenant_id` from an employee chat message as source of truth. For bot-facing chat, resolve tenant server-side from the registered user link or company code.

## Local Setup

Install dependencies:

```bash
npm install
```

Start local Supabase (Docker) and apply migrations plus `supabase/seed.sql`:

```bash
npx supabase start
```

To wipe the local database and re-run migrations and seed:

```bash
npx supabase db reset
```

Create local env (point URLs and keys at the local stack from `npx supabase status`):

```bash
cp .env.example .env
```

With Supabase CLI 2.x, `status` prints **Publishable** and **Secret** keys (`sb_publishable_*` / `sb_secret_*`). Put the Publishable value in `NEXT_PUBLIC_SUPABASE_ANON_KEY` and the Secret in `SUPABASE_SERVICE_ROLE_KEY` in the same edit—do not mix them with the older demo JWT anon key (`eyJ...`) or PostgREST may return `PGRST301`.

Run dev server (loads `.env` first — useful with local Supabase):

```bash
npm run dev:local -- -p 4000
```

If **`.env.local` exists**, Next.js still loads it in development (`Environments: .env.local, .env`). For any **duplicate variable name**, **`.env.local` wins** over `.env`. So either: keep Supabase keys in **only one** of the two files, or give them the **same** values in both. Otherwise `npm run dev:local` can look like it “uses `.env`” while runtime still picks remote/wrong keys from `.env.local`.

Or without forcing `.env` load order:

```bash
npm run dev -- -p 4000
```

Open:

- App: `http://localhost:4000`
- Login: `http://localhost:4000/login`
- First platform admin setup: `http://localhost:4000/setup/platform-admin` (hosted / non-seeded projects)
- Platform dashboard: `http://localhost:4000/platform`
- Company dashboard: `http://localhost:4000/dashboard`

### Local admin login (seeded)

After `supabase start` or `supabase db reset`, the seed creates **one** platform admin if no `platform_admin` row exists yet in `public.users`:

| Field    | Value                      |
| -------- | -------------------------- |
| Email    | `platform-admin@local.dev` |
| Password | `LocalDev123!`             |

Use these on `/login` with local Supabase and an `.env` that matches `npx supabase status` (project URL, anon key, service role key). This account is for **local development only**; do not rely on it on hosted Supabase (seed is not applied the same way on remote `db push`).

## API Documentation

Swagger/OpenAPI documentation is available at `docs/openapi.yaml`.
A PDF export for sharing with the integration team is available at `docs/api-documentation.pdf`.

Use it with Swagger Editor, Swagger UI, Postman, Insomnia, or any OpenAPI-compatible client generator. The spec covers:

- Bot-facing APIs: `/api/v1/register`, `/api/v1/chat`, `/api/v2/chat`, `/api/v1/config`, `/api/v1/usage`, `/api/v1/health`
- Central bot auth via `x-central-bot-secret`
- Legacy tenant API key auth via `x-api-key`
- Admin APIs for tenant management, AI settings, documents, playground, and legacy API keys
- Main request/response schemas and shared error formats

Postman import files are also available:

- Collection: `docs/postman-ai-chatbot-api.collection.json`
- Local environment template: `docs/postman-local.environment.json`

To test chat in Postman:

1. Import both files into Postman.
2. Select the `AI Employee Support Bot - Local` environment.
3. Set `central_bot_secret` from `.env` or `.env.local` (`CENTRAL_BOT_SECRET`).
4. Set `company_code` from the tenant detail page in Platform Admin.
5. Run `1. Register LINE User With Company Code`.
6. Run `3. Chat - Linked User` to test normal chat.

For a simplified LINE-shaped flow, use `/api/v2/chat` with:

- `user_id`
- `message`
- `company_code`

Use `x-central-bot-secret` as usual. If the client cannot set that header, send **`workflow_token`** in the same JSON body (v2 only).

## Environment Variables

Required for a real Supabase/OpenAI environment:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
APP_URL=http://localhost:4000
DEFAULT_TRIAL_DAYS=35
DEFAULT_TRIAL_MESSAGE_LIMIT=500
DEFAULT_PRO_MESSAGE_LIMIT=30000
DEFAULT_MAX_SENTENCES=5
API_KEY_SECRET=
CENTRAL_BOT_SECRET=
CRON_SECRET=
```

Optional — **Mindbloom company mirror** after Platform Admin creates a tenant (`createTenantOnboarding`). When both are set, SaaS `POST`s to Mindbloom Edge `saas-company-provision` with `company_code`, `tenant_id`, `tenant_name`, `plan`, and `departments`, with retries (best-effort; onboarding still succeeds if Mindbloom is down). Use the same bearer value as Mindbloom secret `SAAS_PROVISION_SECRET`.

```env
MINDBLOOM_PROVISION_URL=https://<project-ref>.supabase.co/functions/v1/saas-company-provision
MINDBLOOM_PROVISION_SECRET=
```

Optional model env fallbacks:

```env
AI_MODEL_GENERAL=gpt-5-nano
AI_MODEL_RAG=gpt-5-mini
AI_MODEL_SAFETY=gpt-5-mini
AI_MODEL_EMBEDDING=text-embedding-3-small
```

Notes:

- `SUPABASE_SERVICE_ROLE_KEY` is server-only. Never expose it to browser code.
- `CENTRAL_BOT_SECRET` is used by trusted central bot backend calls to `/api/v1/*`.
- `CRON_SECRET` is used by scheduled jobs such as `/api/jobs/expire-trials`.
- `MINDBLOOM_PROVISION_URL` / `MINDBLOOM_PROVISION_SECRET` are server-only; used to notify Mindbloom after tenant onboarding. Omit both to disable.
- `API_KEY_SECRET` is used only for legacy tenant API key hashing.
- Model values can also be controlled per tenant by Platform Admin in the UI.

## Supabase Database

Migrations live in:

```text
supabase/migrations/
```

Current migration themes:

- `0001_initial_schema.sql` - base tenants/users/RLS/documents/messages/usage/model pricing schema
- `0002_central_bot_mode.sql` - company codes, employee tenant links, platform bot settings
- `0003_backfill_tenant_company_codes.sql` - company code backfill for existing tenants
- `0004_platform_ai_settings.sql` - platform AI setting fields
- `0005_tenant_ai_settings.sql` - per-tenant AI setting fields and RLS update
- `0006_workflow_tokens.sql` - tenant-scoped workflow tokens for headerless HTTP clients
- `0007_free_plan_trial_downgrade.sql` - allows the `free` tenant plan for automatic trial downgrade

Link the CLI to your hosted project once (`supabase login`, then `supabase link --project-ref …` — see comments in [`.env.example`](.env.example)). Use the same Supabase API values in `.env` or `.env.local` for the app.

Local seed data lives in [`supabase/seed.sql`](supabase/seed.sql) (one seeded platform admin; see **Local admin login (seeded)** above). It runs after migrations on `supabase db reset` and on first `supabase start` for a fresh volume.

Push pending migrations:

```bash
supabase db push --dry-run
supabase db push --yes
```

## Scheduled Jobs

Expire active trials and downgrade them to `free`:

```http
POST /api/jobs/expire-trials
Authorization: Bearer <CRON_SECRET>
```

Run this from your hosting scheduler or any trusted cron service at least once per day. The job finds active tenants where `plan = "trial"` and `trial_ends_at <= now()`, changes them to `plan = "free"` and `status = "expired"`, inserts an audit log, and pushes the updated plan to the configured Mindbloom provisioning endpoint.

Important tables:

- `tenants`
- `users`
- `tenant_members`
- `tenant_profiles`
- `tenant_company_codes`
- `employee_tenant_links`
- `bot_settings`
- `documents`
- `document_chunks`
- `conversations`
- `messages`
- `usage_logs`
- `escalation_settings`
- `model_pricing`
- `audit_logs`

Storage bucket:

- `tenant-documents`

## User Roles

### Platform Admin

Can:

- Manage all tenants
- Create/delete tenants
- View tenant usage and conversations
- Manage each tenant AI settings
- Upload/delete each tenant RAG documents
- Manage model pricing
- View audit logs

### Company Admin / Tenant Admin

Can:

- Manage own company profile
- Manage own knowledge base documents
- View own usage and conversations
- Manage safety/handoff contact settings
- View company code / bot access instructions

Cannot:

- Edit AI settings
- Choose models
- Edit system instructions
- Access another tenant data

## Admin Workflows

### First Platform Admin

Open:

```text
/setup/platform-admin
```

This creates the initial Platform Admin via Supabase Auth and the `users` table.

### Create Tenant

Open:

```text
/platform/tenants
```

Tenant creation also:

- Generates tenant slug/workspace id
- Creates tenant profile
- Creates tenant admin user
- Creates tenant membership
- Generates tenant company code
- Creates default tenant AI settings
- Creates escalation settings

The generated company code is the code employees use when registering from LINE.

### Tenant AI Settings

Open:

```text
/platform/tenants/[tenant_id]/ai-settings
```

Platform Admin can configure per tenant:

- Bot name
- Tone
- Default language: Thai, English, or both
- Max sentences
- General support model
- RAG answer model
- Safety/classification model
- Embedding model
- RAG enabled
- Wellbeing support enabled
- Safety classifier enabled
- Human handoff enabled
- LLM classification fallback enabled
- System instruction

These settings are stored in `bot_settings` and are not editable by Company Admin.

### Knowledge Base / RAG Documents

Platform Admin:

```text
/platform/tenants/[tenant_id]/knowledge-base
```

Company Admin:

```text
/dashboard/knowledge-base
```

Supported upload types:

- PDF
- DOCX
- TXT
- Markdown

Upload flow:

1. Create `documents` record.
2. Upload raw file to Supabase Storage.
3. Extract text.
4. Chunk text.
5. Create OpenAI embeddings.
6. Store chunks in `document_chunks`.
7. Mark document `ready` or `failed`.

Delete flow:

1. Remove object from Supabase Storage.
2. Delete `documents` row.
3. `document_chunks` are deleted by cascade.
4. Write audit log.

## Bot-Facing API

Base URL examples use local dev:

```text
http://localhost:4000
```

Use this header for the central LINE bot flow:

```http
x-central-bot-secret: <CENTRAL_BOT_SECRET>
```

### Register LINE User to Tenant

Use this when a LINE user enters a company code for the first time.

```http
POST /api/v1/register
```

Request:

```bash
curl -X POST http://localhost:4000/api/v1/register \
  -H "x-central-bot-secret: $CENTRAL_BOT_SECRET" \
  -H "content-type: application/json" \
  -d '{
    "line_user_id": "Uxxxxxxxxxxxxxxxx",
    "channel": "line",
    "company_code": "ABCD123",
    "display_name": "Somchai"
  }'
```

Response:

```json
{
  "success": true,
  "tenant_id": "uuid",
  "tenant_name": "Company Name",
  "company_code": "ABCD123",
  "link_id": "uuid",
  "external_user_id": "Uxxxxxxxxxxxxxxxx",
  "channel": "line"
}
```

`company_code` is the **normalized** value (trimmed, uppercase) used for the `tenant_company_codes` row. Downstream mirrors (for example Mindbloom company upsert after register) should key on this field rather than re-parsing the request body.

What gets stored:

- `employee_tenant_links.id` as link UUID
- `employee_tenant_links.tenant_id`
- `employee_tenant_links.external_user_id`
- `employee_tenant_links.channel`
- `employee_tenant_links.company_code_id`

### Chat

```http
POST /api/v1/chat
```

For HTTP clients that **cannot set custom headers** (some workflow builders), send a **tenant-scoped `workflow_token`** in the JSON body of **`POST /api/v2/chat`** together with `user_id`, `message`, and `company_code`. Create tokens in the admin UI (`/dashboard/workflow-tokens` or Platform Admin → tenant → **Workflow HTTP**) or via `POST /api/admin/workflow-tokens`; the raw value is returned once as `rawToken`. Do not put `CENTRAL_BOT_SECRET` in JSON bodies.

```bash
curl -X POST http://localhost:4000/api/v2/chat \
  -H "content-type: application/json" \
  -d '{
    "workflow_token": "wf_live_...",
    "user_id": "Uxxxxxxxxxxxxxxxx",
    "message": "ลาป่วยได้กี่วัน",
    "company_code": "ABCD123"
  }'
```

`company_code` is required on first contact for that `user_id` unless the user is already linked; the code must belong to the same tenant as the workflow token.

Request after registration (central bot, header auth):

```bash
curl -X POST http://localhost:4000/api/v1/chat \
  -H "x-central-bot-secret: $CENTRAL_BOT_SECRET" \
  -H "content-type: application/json" \
  -d '{
    "external_user_id": "Uxxxxxxxxxxxxxxxx",
    "channel": "line",
    "conversation_id": "line-room-or-user-id",
    "message": "ลาป่วยได้กี่วัน"
  }'
```

Request with company code in the same call:

```bash
curl -X POST http://localhost:4000/api/v1/chat \
  -H "x-central-bot-secret: $CENTRAL_BOT_SECRET" \
  -H "content-type: application/json" \
  -d '{
    "external_user_id": "Uxxxxxxxxxxxxxxxx",
    "channel": "line",
    "company_code": "ABCD123",
    "message": "สวัสดิการประกันสุขภาพมีอะไรบ้าง"
  }'
```

Success response shape:

```json
{
  "success": true,
  "reply": "ข้อความตอบกลับ",
  "message_type": "rag",
  "safety_level": "normal",
  "conversation_id": "uuid",
  "sources": [
    {
      "document_name": "benefits.pdf",
      "category": "benefits",
      "section": "Chunk 1",
      "score": 0.82
    }
  ],
  "handoff_required": false,
  "handoff": {
    "enabled": false,
    "url": null,
    "button_text": null,
    "message": null
  },
  "quota": {
    "plan": "trial",
    "used": 12,
    "limit": 500,
    "remaining": 488
  }
}
```

If a user has not registered and no company code is provided, the API returns a successful bot-friendly message asking for company code.

### Config

```http
GET /api/v1/config?external_user_id=Uxxx&channel=line
```

Returns tenant company name, tenant AI settings display values, enabled features, and plan limits.

### Usage

```http
GET /api/v1/usage?external_user_id=Uxxx&channel=line
```

Returns current plan, status, message usage, remaining quota, and estimated cost.

### Health

```http
GET /api/v1/health
```

Use for uptime checks.

## Legacy Tenant API Key Flow

The older `x-api-key` tenant integration is still present for compatibility.

Header:

```http
x-api-key: aibot_live_...
```

It uses `API_KEY_SECRET` for HMAC hashing. This is not the recommended path for the central LINE bot.

## AI Routing

Runtime settings are resolved per tenant:

```text
tenant_id -> bot_settings -> model/feature settings
```

Fallbacks:

```text
bot_settings missing -> platform_bot_settings -> env/default models
```

Default env model mapping:

- General support: `gpt-5-nano`
- RAG answers: `gpt-5-mini`
- Safety/classification: `gpt-5-mini`
- Embedding: `text-embedding-3-small`

Message categories:

- `welfare_rag`
- `general_support`
- `mental_health_support`
- `mental_health_sensitive`
- `crisis`
- `out_of_scope`

Routing:

- Welfare/HR/policy questions use RAG model and tenant knowledge base.
- General support uses general model.
- Sensitive/high safety cases use RAG/safety model depending on category.
- Crisis responses use a fixed safety response and handoff payload.
- Out-of-scope uses a fixed response.

Default language per tenant can be:

- `th`
- `en`
- `th,en`

The prompt chooses Thai, English, or both-language behavior based on that setting and the user's message language.

## Quotas and Plans

Trial defaults:

- 35 days
- 500 messages
- 10 files
- 50 MB storage

When an active trial tenant reaches `trial_ends_at`, the scheduled `/api/jobs/expire-trials` job changes the tenant plan to `free`, sets `status = "expired"` to block chat, writes an audit log, and sends the updated `plan` to the Mindbloom company mirror when provisioning env vars are configured. The chat availability check also performs the same downgrade for that tenant if a scheduler is late.

Free defaults:

- 500 messages
- 10 files
- 50 MB storage

Pro defaults:

- 30,000 messages/month
- 100 files
- 1 GB storage

Usage is logged in `usage_logs`. Assistant messages are counted against quota.

## LINE Bot Integration Notes

Integrate LINE by running a **separate adapter** (your own service, LINE Messaging API SDK, or another app) that receives LINE events and calls this SaaS over HTTPS:

1. Receive LINE webhook event on your adapter.
2. Extract LINE `userId` as `external_user_id`.
3. Use `channel = "line"`.
4. If user sends a company code or registration command, call `/api/v1/register`.
5. For normal messages, call `/api/v1/chat` with `x-central-bot-secret`, or `/api/v2/chat` with the same header. If the HTTP client cannot set headers, call **`POST /api/v2/chat`** with **`workflow_token`** in the JSON (not v1).
6. Send `reply` from API response back to LINE.
7. If `handoff_required` or `handoff.enabled` is true, show handoff URL/button/message in LINE UX if supported.

Pseudo flow:

```ts
const externalUserId = event.source.userId;
const message = event.message.text;

if (isRegistrationMessage(message)) {
  await fetch(`${APP_URL}/api/v1/register`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-central-bot-secret": CENTRAL_BOT_SECRET,
    },
    body: JSON.stringify({
      line_user_id: externalUserId,
      channel: "line",
      company_code: extractCompanyCode(message),
    }),
  });
}

const response = await fetch(`${APP_URL}/api/v1/chat`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-central-bot-secret": CENTRAL_BOT_SECRET,
  },
  body: JSON.stringify({
    external_user_id: externalUserId,
    channel: "line",
    conversation_id: event.source.groupId ?? externalUserId,
    message,
  }),
});
```

## Admin API Summary

Admin routes require Supabase Auth session cookies.

- `POST /api/setup/platform-admin`
- `POST /api/admin/tenants`
- `PATCH /api/admin/tenants/[id]`
- `DELETE /api/admin/tenants/[id]`
- `PATCH /api/admin/tenants/[id]/ai-settings`
- `POST /api/admin/documents`
- `DELETE /api/admin/documents/[id]`
- `POST /api/admin/playground`
- `POST /api/admin/api-keys`
- `DELETE /api/admin/api-keys/[id]`
- `GET /api/admin/workflow-tokens?tenant_id=...`
- `POST /api/admin/workflow-tokens`
- `DELETE /api/admin/workflow-tokens/[id]`
- `PATCH /api/admin/platform-ai-settings` (legacy/global fallback page redirects away)

## Important Pages

Platform Admin:

- `/platform`
- `/platform/tenants`
- `/platform/tenants/[id]`
- `/platform/tenants/[id]/ai-settings`
- `/platform/tenants/[id]/knowledge-base`
- `/platform/tenants/[id]/employees`
- `/platform/tenants/[id]/workflow-tokens`
- `/platform/tenants/[id]/usage`
- `/platform/tenants/[id]/conversations`
- `/platform/tenants/[id]/safety`
- `/platform/model-pricing`
- `/platform/audit-logs`

Company Admin:

- `/dashboard`
- `/dashboard/knowledge-base`
- `/dashboard/playground`
- `/dashboard/usage`
- `/dashboard/conversations`
- `/dashboard/safety`
- `/dashboard/settings/company-profile`
- `/dashboard/api-keys` (company code / bot access instructions)
- `/dashboard/workflow-tokens` (workflow HTTP tokens for headerless clients)

Company Admin does not have AI settings access.

## Development Commands

```bash
npm run dev:local -- -p 4000
npm run dev -- -p 4000
npm run lint
npm test
npm run build
```

## Verification Status

Latest verification after recent changes:

- `npm run lint` passed
- `npm test` passed
- `npm run build` passed
- Supabase migrations up to `0007_free_plan_trial_downgrade.sql` pushed successfully

## Security Notes

- Some workflow tools cannot attach bot headers. Send a per-tenant **`workflow_token`** in the JSON body of **`POST /api/v2/chat`** (create in **Workflow HTTP** admin UI or `POST /api/admin/workflow-tokens`). Never put `CENTRAL_BOT_SECRET` in JSON bodies.
- Never expose `SUPABASE_SERVICE_ROLE_KEY`, `CENTRAL_BOT_SECRET`, or `API_KEY_SECRET` in browser code.
- Only variables prefixed with `NEXT_PUBLIC_` are safe for browser exposure.
- Bot-facing central endpoints must be called from trusted bot backend code, not directly from LINE client/user devices.
- Tenant admins must not be able to edit AI system instructions or model settings.
- Platform admins should audit model changes because they affect cost and response behavior.
- RAG retrieval must always filter by `tenant_id`.
- Do not trust content inside uploaded documents as instructions; RAG prompts treat document text as untrusted facts only.

## Known Follow-Ups

- Replace placeholder model names with model IDs available in the OpenAI account if needed.
- Keep `model_pricing` updated for any model used in AI settings so cost tracking remains accurate.
- Add production rate limiting for bot-facing endpoints before public deployment.
