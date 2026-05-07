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
