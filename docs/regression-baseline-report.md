# Regression Baseline Report

Generated: 2026-05-13

## Scope

This baseline captures the current behavior of the AI Employee Support Bot SaaS backend before any refactoring work begins.

The suite focuses on:

- Bot API authentication and response shapes
- Simplified `/api/v2/chat` behavior
- Existing `/api/v1/chat` fallback behavior
- Platform admin authorization boundaries
- Tenant company-code linking
- RAG-disabled chat runtime behavior
- Existing pure business logic tests

## Baseline Before Adding Tests

- `npm run lint`: passed
- `npm run test`: passed, 4 test files, 8 tests
- `npm run build`: passed

## Baseline After Adding Regression Tests

- `npm run lint`: passed
- `npm run test`: passed, 12 test files, 28 tests
- `npm run build`: passed

## Added Regression Coverage

### Shared Test Fixtures

- `src/test/fixtures.ts`
- `src/test/mockNextRequest.ts`
- `src/test/mockSupabase.ts`

### P0 Unit Tests

- `src/lib/api/auth.test.ts`
  - missing central bot secret returns `401`
  - invalid central bot secret returns `401`
  - valid central bot secret is accepted
- `src/lib/validation/chat.test.ts`
  - valid v2 chat payload is accepted
  - missing v2 required fields are rejected
- `src/lib/services/platformAiSettingsService.test.ts`
  - RAG runtime flag is disabled
  - persisted `rag_enabled: true` normalizes to `false`
  - default language normalization preserves supported values

### P0 API Route Integration Tests

- `src/app/api/v2/chat/route.test.ts`
  - invalid/missing central bot auth returns `401`
  - invalid payload returns `400`
  - invalid company code returns `404` and does not call AI orchestration
  - valid v2 request links tenant context and delegates to chat orchestration
- `src/app/api/v1/chat/route.test.ts`
  - unresolved central bot user receives company-code prompt
  - legacy API-key flow is still reachable when central bot header is absent
- `src/app/api/admin/tenants/route.test.ts`
  - unauthenticated tenant creation returns `401`
  - tenant admin tenant creation returns `403`
  - platform admin tenant creation calls onboarding with creator attribution

### P0 Service Tests

- `src/lib/services/centralBotService.test.ts`
  - active company code creates/upserts employee tenant link
  - invalid company code does not create employee link
- `src/lib/services/aiService.test.ts`
  - welfare-style questions no longer call RAG retrieval while RAG runtime is disabled
  - usage logging remains tenant-scoped and uses `general` request type

## Passed Tests

All regression tests currently pass:

- Test files: 12 passed
- Tests: 28 passed

## Failed Tests

None.

## Skipped Tests

None implemented yet.

## Expected-To-Fail Tests

None implemented yet.

## Known Security Regression Targets

These should be added as explicit security tests before or during the security refactor phase:

- Cross-tenant access probes for admin API-key and playground routes.
- Tenant admin attempts to access platform per-tenant pages and APIs beyond document routes.
- Document delete attempts across tenants with service-role Supabase client mocked to return another tenant's document.
- Setup endpoint abuse checks after platform admin already exists.
- Error body checks to ensure raw Supabase/OpenAI internals are not exposed in public bot APIs.

## Missing Coverage

- No browser E2E coverage yet.
- No Playwright config yet.
- No real Supabase local test database; route/service tests use mocks only.
- No coverage reporting command yet.
- No explicit `npm run typecheck` script yet; `next build` currently performs TypeScript validation.
- No tests for document upload file-size/category boundaries beyond existing filename/chunk unit tests.
- No tests for login/logout UI behavior yet.

## Refactor Safety Gate

After each refactor step, run:

```bash
npm run lint
npm run test
npm run build
```

The refactor step should be accepted only if these commands pass, or if any failing tests are intentionally updated with a documented behavior change.
