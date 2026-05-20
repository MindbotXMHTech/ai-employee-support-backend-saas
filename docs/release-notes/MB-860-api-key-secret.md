# MB-860 — `API_KEY_SECRET` fail closed

## What changed

- Removed the `development-api-key-secret` fallback from API key and workflow token HMAC hashing.
- Missing `API_KEY_SECRET` throws at hash time (`requireEnv`) and aborts production server boot (`src/instrumentation.ts`).

## Deploy checklist

1. **Vercel / production runtime:** Project → Settings → Environment Variables → add `API_KEY_SECRET` (random 32+ bytes, e.g. `openssl rand -hex 32`) for **Production**. Add to **Preview** too if preview environments create or validate workflow tokens / legacy API keys.
2. **CI smoke tests:** If a pipeline runs `NODE_ENV=production npm run start` (or equivalent), inject the same variable in CI secrets — boot fails without it.
3. **Local dev:** Set `API_KEY_SECRET` in `.env.local` before using Workflow HTTP tokens or legacy `x-api-key` flows. Central bot (`x-central-bot-secret`) does not require this variable by itself.

## Key rotation (ops — only if production ever ran without `API_KEY_SECRET`)

If any environment previously relied on the old default hash secret:

1. Set a new strong `API_KEY_SECRET` in Vercel (and CI if applicable).
2. Redeploy — production boot will succeed once the variable is set.
3. **Revoke and re-issue** all legacy tenant API keys (`api_keys` table) and workflow HTTP tokens (`workflow_tokens` table). Old hashes will not match the new secret.
4. Update any external systems (Zwiz, workflow builders) with new `rawToken` / `x-api-key` values.
5. Audit `audit_logs` for `api_key.*` / `workflow_token.*` around the misconfiguration window if compliance requires it.

No automatic DB migration re-hashes existing rows — rotation is intentional and manual.
