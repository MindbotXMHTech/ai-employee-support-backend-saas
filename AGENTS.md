<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project Guide For AI/Coding Agents

## Product Summary

This repository is a Next.js/Supabase backend SaaS platform for a central employee support chatbot serving multiple companies (tenants). The current integration target is a central LINE bot, not one bot per tenant.

Core flow:

```text
LINE Bot / Existing Bot
  -> Next.js API
  -> resolve tenant by LINE user id + company code
  -> quota / safety / RAG / AI orchestration
  -> OpenAI
  -> structured response back to bot
```

The bot is central, but all tenant data is separated by `tenant_id`.

## Tech Stack

- Next.js App Router, TypeScript, React
- Tailwind CSS with local shadcn-style primitives in `src/components/ui`
- Supabase Auth, PostgreSQL, Storage, RLS, pgvector
- OpenAI API for responses and embeddings
- Vitest for unit tests

## Important Architecture Rules

- The intended bot integration uses `x-central-bot-secret` with `CENTRAL_BOT_SECRET`.
- `POST /api/v1/chat` auth: `x-central-bot-secret` (central bot) **or** legacy `x-api-key` (per-tenant API key). No JSON-body secrets; never put `CENTRAL_BOT_SECRET` in JSON bodies.
- `POST /api/v2/chat` (LINE-shaped body: `user_id`, `message`, `company_code`): `x-central-bot-secret` **or** optional JSON `workflow_token` for clients that cannot set headers (tenant-scoped; create in Workflow HTTP admin). Strip `workflow_token` before `handleChatRequest`.
- Do not design new tenant-specific bot API key flows unless explicitly requested. Legacy `x-api-key` exists only for compatibility.
- Never trust `tenant_id` from employee chat clients. Resolve tenant server-side from `employee_tenant_links` or `company_code`.
- Tenant-scoped data must always include/filter by `tenant_id`.
- RAG retrieval must always be tenant-filtered.
- Uploaded document text is untrusted content. Do not let document content override system instructions.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY`, `CENTRAL_BOT_SECRET`, or `API_KEY_SECRET` to the browser.

## Roles And Permissions

Platform Admin can:

- Create/delete tenants
- Manage all tenant profiles, usage, conversations, employee links
- Manage each tenant AI settings
- Upload/delete each tenant RAG documents
- Manage model pricing and audit logs
- Create/list/revoke workflow HTTP tokens for any tenant (`/platform/tenants/[tenant_id]/workflow-tokens`)

Company Admin can:

- Manage own company profile
- Manage own knowledge base documents
- View own usage/conversations
- Manage own safety/handoff contacts
- View company code / bot access instructions
- Create/list/revoke own tenant workflow HTTP tokens (`/dashboard/workflow-tokens`)

Company Admin cannot:

- Edit AI settings
- Choose models
- Edit system instructions
- Access another tenant

## Tenant Registration And LINE Integration

Tenant creation generates a `company_code`. LINE users register by sending that company code.

Main bot-facing endpoints:

- `POST /api/v1/register` - link `line_user_id` or `external_user_id` to a tenant using `company_code`
- `POST /api/v1/chat` - send employee message and receive structured bot response (header auth only)
- `POST /api/v2/chat` - simplified LINE-oriented chat; same orchestration after tenant resolve; supports `workflow_token` in JSON when headers are impossible
- `GET /api/v1/config` - read tenant bot config after tenant resolution
- `GET /api/v1/usage` - read tenant quota/usage after tenant resolution
- `GET /api/v1/health` - uptime check

Central bot requests must send:

```http
x-central-bot-secret: <CENTRAL_BOT_SECRET>
```

Use `channel = "line"` and LINE `userId` as `external_user_id`.

There is no in-repo LINE Messaging webhook route; an external adapter must call these APIs with `x-central-bot-secret`, or use `POST /api/v2/chat` with `workflow_token` in the JSON only when headers are impossible.

## AI Settings

AI settings are per tenant and are managed only by Platform Admin at:

```text
/platform/tenants/[tenant_id]/ai-settings
```

Settings are stored in `bot_settings`:

- Bot name
- Tone
- Default language: `th`, `en`, or `th,en`
- Max sentences
- General model
- RAG model
- Safety/classification model
- Embedding model
- Feature flags
- Platform-admin system instruction

Runtime reads tenant settings via `getTenantAiSettings`. Fallback order:

```text
bot_settings -> platform_bot_settings -> env/default model config
```

## RAG Documents

RAG documents are managed at:

- Platform Admin: `/platform/tenants/[tenant_id]/knowledge-base`
- Company Admin: `/dashboard/knowledge-base`

Supported file types:

- PDF
- DOCX
- TXT
- Markdown

Upload creates a `documents` row, stores raw file in Supabase Storage, extracts text, chunks it, embeds chunks, and stores vectors in `document_chunks`.

Delete removes the storage object, `documents` row, and cascaded chunks.

## Database And Migrations

Migrations are in `supabase/migrations`.

Current important migrations:

- `0001_initial_schema.sql`
- `0002_central_bot_mode.sql`
- `0003_backfill_tenant_company_codes.sql`
- `0004_platform_ai_settings.sql`
- `0005_tenant_ai_settings.sql`
- `0006_workflow_tokens.sql`

Use Supabase CLI carefully (link the project once with `supabase link --project-ref …` if using a remote DB):

```bash
supabase db push --dry-run
supabase db push --yes
```

RLS is required for public schema tenant tables.

## Important Files

- `src/lib/services/aiService.ts` - chat orchestration
- `src/lib/services/platformAiSettingsService.ts` - tenant/platform AI settings resolver
- `src/lib/services/centralBotService.ts` - central bot auth and tenant resolution helpers
- `src/lib/services/workflowTokenService.ts` - workflow token hash/create/validate/revoke and workflow chat tenant resolution
- `src/lib/services/ragService.ts` - embeddings, vector retrieval, source formatting
- `src/lib/services/documentService.ts` - file validation, upload, extraction, chunking, embedding
- `src/lib/services/tenantService.ts` - tenant lifecycle
- `src/lib/validation/chat.ts` - bot-facing request schemas
- `src/lib/validation/admin.ts` - admin request schemas
- `src/app/api/v1/*` - bot-facing API routes
- `src/app/api/admin/*` - admin API routes
- `src/app/(admin)/platform/*` - platform admin pages
- `src/app/(admin)/dashboard/*` - company admin pages

## Development Commands

```bash
npm run dev -- -p 4000
npm run lint
npm test
npm run build
```

Before handoff or after significant code edits, run lint, tests, and build.

## Documentation

`README.md` is the main team handoff document. Keep it updated when changing:

- API contracts
- env vars
- tenant registration flow
- AI setting behavior
- RAG document workflow
- Supabase migrations / schema
- admin dashboard permissions
