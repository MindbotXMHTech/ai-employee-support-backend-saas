# เอกสาร Regression Test Suite

วันที่สร้าง: 2026-05-13

## วัตถุประสงค์

เอกสารนี้อธิบาย regression safety net ที่สร้างไว้ก่อนเริ่ม refactor ระบบ AI Employee Support Bot SaaS platform

เป้าหมายคือเก็บพฤติกรรมปัจจุบันที่ตั้งใจให้ระบบทำงานไว้เป็น baseline เพื่อให้การ refactor ในอนาคตปลอดภัยขึ้น ชุดทดสอบนี้ไม่ได้มีไว้เพื่อรับรองพฤติกรรมที่ไม่ปลอดภัย หากพบพฤติกรรมที่น่าสงสัยหรือ security coverage ยังไม่ครบ จะถูกแยกไว้ในรายการ security regression target สำหรับ phase refactor ด้านความปลอดภัย

## ระบบที่ทดสอบ

- Framework: Next.js App Router
- Language: TypeScript
- Runtime/API: Next.js route handlers
- Auth: Supabase Auth, central bot secret, legacy API keys
- Database/storage: Supabase PostgreSQL, Supabase Storage
- AI integration: OpenAI โดย mock ใน test
- Test runner: Vitest

## ขอบเขต Regression

ชุดทดสอบเริ่มต้นครอบคลุมพฤติกรรมระดับ P0 ดังนี้:

- การยืนยันตัวตนของ central bot
- integration ของ `/api/v2/chat` แบบ simplified
- fallback behavior เดิมของ `/api/v1/chat`
- authorization ของ Platform Admin สำหรับการสร้าง tenant
- การผูก tenant ด้วย company code
- runtime behavior หลังปิด RAG
- pure business logic tests ที่มีอยู่เดิม

ชุดทดสอบนี้ตั้งใจหลีกเลี่ยง production data, real Supabase calls, real OpenAI calls, email, payment และ external services ทั้งหมด

## คำสั่งทดสอบ

รัน regression safety gate ทั้งหมดด้วยคำสั่ง:

```bash
npm run lint
npm run test
npm run build
```

ผล baseline ปัจจุบัน:

- `npm run lint`: passed
- `npm run test`: passed, 12 test files, 28 tests
- `npm run build`: passed

## รายการไฟล์ทดสอบ

### Tests เดิมที่มีอยู่

- `src/lib/services/apiKeyService.test.ts`
- `src/lib/services/classificationService.test.ts`
- `src/lib/services/costService.test.ts`
- `src/lib/services/documentService.test.ts`

### Shared Test Utilities ที่เพิ่ม

- `src/test/fixtures.ts`
  - fixtures สำหรับ fake tenant, platform admin, tenant admin และ stable chat response
- `src/test/mockNextRequest.ts`
  - helper สำหรับสร้าง `NextRequest` object เพื่อใช้กับ route handler tests
- `src/test/mockSupabase.ts`
  - Supabase mock แบบ chainable ขนาดเล็กสำหรับ service tests

### P0 Unit Tests ที่เพิ่ม

- `src/lib/api/auth.test.ts`
  - ตรวจสอบ behavior ของ central bot secret authentication
- `src/lib/validation/chat.test.ts`
  - ตรวจสอบ request schema ของ `/api/v2/chat`
- `src/lib/services/platformAiSettingsService.test.ts`
  - ตรวจสอบว่า RAG runtime ถูกปิด และ language normalization ยัง stable

### P0 API Route Tests ที่เพิ่ม

- `src/app/api/v2/chat/route.test.ts`
  - ตรวจสอบ auth rejection, validation errors, invalid company code behavior และการ delegate ไป chat orchestration เมื่อ request ถูกต้อง
- `src/app/api/v1/chat/route.test.ts`
  - ตรวจสอบว่า unresolved central bot user ได้รับ company-code prompt และ legacy API-key flow ยังใช้งานได้
- `src/app/api/admin/tenants/route.test.ts`
  - ตรวจสอบว่า unauthenticated users และ tenant admins ไม่สามารถสร้าง tenant ได้ แต่ platform admins สามารถทำได้

### P0 Service Tests ที่เพิ่ม

- `src/lib/services/centralBotService.test.ts`
  - ตรวจสอบการ link employee ด้วย company code และการ reject invalid code
- `src/lib/services/aiService.test.ts`
  - ตรวจสอบว่าคำถามแนว welfare ไม่ trigger RAG retrieval เมื่อ RAG runtime ถูกปิด และ usage ยังคง scoped ตาม tenant

## Critical Flow Coverage

| Flow ID | Flow Name | Type | Priority | Entry Point | Expected Behavior | Test Type |
| --- | --- | --- | --- | --- | --- | --- |
| P0-SMOKE-001 | App builds successfully | smoke path | P0 | `npm run build` | Next.js compile API และ admin routes สำเร็จ | command baseline |
| P0-SMOKE-002 | Lint and unit suite complete | smoke path | P0 | `npm run lint`, `npm run test` | static checks และ tests ผ่าน | command baseline |
| P0-API-001 | V2 simplified central chat | happy path / integration path | P0 | `src/app/api/v2/chat/route.ts` | request ที่ถูกต้อง resolve tenant และ delegate ไป chat orchestration | route integration |
| P0-API-002 | V2 chat rejects invalid secret | security path / failure path | P0 | `src/app/api/v2/chat/route.ts` | central bot secret ที่หายไปหรือไม่ถูกต้อง return `401` | route integration |
| P0-API-003 | V2 chat rejects invalid company code | failure path | P0 | `src/app/api/v2/chat/route.ts` | invalid company code return `404` และไม่เรียก AI orchestration | route integration |
| P0-API-004 | V1 central chat registration fallback | edge case | P0 | `src/app/api/v1/chat/route.ts` | unresolved user ได้รับ company-code prompt | route integration |
| P0-AUTH-001 | Central bot secret validation | security path | P0 | `src/lib/api/auth.ts` | missing, wrong และ valid secrets ทำงานสม่ำเสมอ | unit |
| P0-AUTH-002 | Admin API rejects unauthenticated users | security path | P0 | `src/app/api/admin/tenants/route.ts` | ไม่มี admin session แล้ว return `401` | route integration |
| P0-AUTH-003 | Platform-only admin APIs reject tenant admins | security path | P0 | `src/app/api/admin/tenants/route.ts` | tenant admin ได้รับ `403` | route integration |
| P0-TENANT-001 | Tenant company code links employee | integration path | P0 | `src/lib/services/centralBotService.ts` | active code สร้างหรือ upsert employee tenant link | service integration |
| P0-BIZ-001 | Chat runtime no longer uses RAG | business regression | P0 | `src/lib/services/aiService.ts` | ไม่มีการเรียก RAG retrieval และ usage log เป็น general | service integration |

## Security Regression Coverage

สรุปความเสี่ยงจากการรีวิวโค้ดและแบ่งตามระดับ: [`security-concerns.md`](./security-concerns.md)

สิ่งที่ครอบคลุมแล้ว:

- ไม่มี central bot secret แล้ว return `401`
- central bot secret ไม่ถูกต้องแล้ว return `401`
- invalid `/api/v2/chat` company code แล้ว return `404`
- invalid `/api/v2/chat` company code ไม่เรียก AI orchestration
- unauthenticated admin tenant creation แล้ว return `401`
- tenant admin tenant creation แล้ว return `403`
- invalid company code ไม่สร้าง employee links

Security regression targets ที่ยังควรเพิ่ม:

- cross-tenant access probes สำหรับ admin API-key และ playground routes
- brute-force / abuse probes ของ `POST /api/v1/partner/tenants` (rate limit / log)
- tenant admin พยายามเข้าถึง platform per-tenant APIs ที่เกินกว่า document routes
- document delete attempts ข้าม tenant
- setup endpoint abuse checks หลังจากมี platform admin แล้ว
- ตรวจ error body เพื่อให้มั่นใจว่า raw Supabase/OpenAI internals ไม่ถูก expose ผ่าน public bot APIs

## Mocking Strategy

Regression suite นี้ใช้ deterministic mocks:

- Supabase ถูก mock ด้วย chainable objects ตาม scenario
- ไม่มีการเรียก OpenAI จริงใน tests
- API route auth และ service dependencies ถูก mock ด้วย `vi.doMock`
- test identities ใช้ fixed fixtures: platform admin, tenant admin, tenant, chat response
- ไม่ต้องใช้ production data หรือ production secrets

## Baseline Report

ผล baseline แบบละเอียดถูกบันทึกไว้ที่:

- `docs/regression-baseline-report.md`

สรุป:

- test files ก่อนเพิ่ม suite: 4
- tests ก่อนเพิ่ม suite: 8
- test files หลังเพิ่ม suite: 12
- tests หลังเพิ่ม suite: 28
- failed tests: 0
- skipped tests: 0
- expected-to-fail tests: 0

## Refactor Safety Gate

ก่อนยอมรับ refactor step ใด ๆ ให้รัน:

```bash
npm run lint
npm run test
npm run build
```

refactor ควรถูกยอมรับก็ต่อเมื่อ:

- baseline tests ทั้งหมดยังผ่าน
- หรือ failures เป็นสิ่งที่ตั้งใจและมีเอกสารอธิบาย behavior change แล้ว

## Missing Coverage

ชุดทดสอบปัจจุบันเป็น P0 baseline ที่ใช้งานได้จริง แต่ยังไม่ใช่ full coverage

พื้นที่ที่ยังขาด coverage:

- Browser E2E tests
- Login/logout UI tests
- Document upload/delete authorization boundary tests
- Local Supabase integration tests
- Coverage reporting
- standalone `typecheck` script
- full cross-tenant security regression suite

## Tests ที่แนะนำให้ทำต่อ

รายการที่ควรเพิ่มก่อน refactor ด้าน security หรือ architecture ครั้งใหญ่:

1. Admin document upload/delete authorization tests
2. Setup platform admin first-run และ already-exists tests
3. Login redirect rule tests สำหรับ platform admins vs tenant admins
4. Cross-tenant security tests สำหรับ API keys, playground, documents และ platform tenant routes
5. Optional Playwright smoke tests สำหรับ `/login`, `/dashboard` และ `/platform`
