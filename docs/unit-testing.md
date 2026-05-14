# คู่มือ Unit Tests (Vitest)

อัปเดตความสัมพันธ์กับชุด regression ภาพรวม: [`regression-test-document.md`](./regression-test-document.md) และผล baseline: [`regression-baseline-report.md`](./regression-baseline-report.md).

## เครื่องมือและคำสั่ง

| คำสั่ง | ความหมาย |
|--------|-----------|
| `npm run test` | รัน Vitest **ครั้งเดียว** (โหมด CI / gate) |
| `npm run test:watch` | รัน Vitest แบบ watch ระหว่างพัฒนา |

**หมายเหตุ:** โปรเจกต์นี้ยังไม่มีสคริปต์แยก `typecheck`; การตรวจ TypeScript หลักทำผ่าน `npm run build` หรือรัน `npx tsc --noEmit` แยกเองเมื่อจำเป็น

## การตั้งค่า Vitest

ไฟล์: `vitest.config.mts`

- **environment:** `node` (เหมาะกับ route handler / service logic ที่ไม่ต้องใช้ DOM จริง)
- **include:** เฉพาะ `src/**/*.test.ts`
- **alias `@`:** ชี้ไปที่ `./src` (สอดคล้องกับ import path ในแอป)

## แนววางที่ตั้งของไฟล์ทดสอบ

| ประเภท | ที่วางไฟล์ | ชื่อไฟล์ |
|--------|-------------|----------|
| Service / validation / auth | ข้างไฟล์ต้นฉบับ | `*.test.ts` |
| Use case / application layer | ข้าง use case | `*.test.ts` |
| Route (App Router API) | ข้าง `route.ts` | `route.test.ts` |

ความคิดโดยสรุป: ทดสอบอยู่ **ใกล้โค้ดที่ผูกกับพฤติกรรม** และค้นหาได้จาก pattern เดียวกันทั้ง repo

## รายการ unit / integration-lite tests ปัจจุบัน

รายการนี้อิงจาก `src/**/*.test.ts` และ Vitest เท่านั้น (ไม่รวม E2E เบราว์เซอร์ เพราะยังไม่มีใน repo)

### Shared utilities (`src/test/`)

| ไฟล์ | บทบาท |
|------|--------|
| `fixtures.ts` | ข้อมูลปลอมคงที่: tenant, admin roles, chat response |
| `mockNextRequest.ts` | สร้าง `NextRequest` สำหรับเรียก `POST(...)` / route handlers |
| `mockSupabase.ts` | chain mock ของ Supabase client สำหรับ service tests |

### Library / validation / auth

| ไฟล์ทดสอบ | สิ่งที่ล็อกพฤติกรรม |
|-----------|---------------------|
| `src/lib/api/auth.test.ts` | Central bot secret: ขาด/ผิด/ถูก |
| `src/lib/validation/chat.test.ts` | Schema ของ v2 และ validation ภายใน scope เดียวกัน |
| `src/lib/services/*.test.ts` | `apiKeyService`, `classificationService`, `costService`, `documentService`, `aiService`, `centralBotService`, `platformAiSettingsService` |

### Application (use cases)

| ไฟล์ทดสอบ | สิ่งที่ล็อกพฤติกรรม |
|-----------|---------------------|
| `src/application/chat/v1-chat.use-case.test.ts` | เส้นทาง company-code prompt และ delegate ไป chat orchestration; map HTTP จาก success/failure |
| `src/application/central-bot/v2-chat.use-case.test.ts` | ลงทะเบียนลิงก์ด้วย company code และ delegate ไป orchestration เมื่อ tenant ได้มาแล้ว |

### Bootstrap / security helpers

| ไฟล์ทดสอบ | สิ่งที่ล็อกพฤติกรรม |
|-----------|---------------------|
| `src/lib/setup/platformSetupAuth.test.ts` | การยืนยัน `PLATFORM_SETUP_SECRET` (เมื่อตั้งค่าใน env) เทียบ header/body แบบ timing-safe |

### API routes (mock-heavy)

| ไฟล์ทดสอบ | Endpoint / ความครอบคลุม |
|-----------|-------------------------|
| `src/app/api/v1/partner/tenants/route.test.ts` | `POST /api/v1/partner/tenants` — ปิดเมื่อไม่มี env, 401, validation, duplicate code, success |
| `src/app/api/v2/chat/route.test.ts` | `POST /api/v2/chat` — auth, validation, delegation ผ่าน use case |
| `src/app/api/v1/chat/route.test.ts` | `POST /api/v1/chat` — unresolved central vs legacy api-key path |
| `src/app/api/admin/tenants/route.test.ts` | สิทธิ์สร้าง tenant (platform vs tenant admin vs unauthenticated) |
| `src/app/api/admin/api-keys/[id]/route.test.ts` | เพิกถอน API key: `404` ถ้าไม่มี row, `403` ถ้า tenant admin ไม่มีสิทธิ์ tenant นั้น, `200` เมื่ออนุญาต |

## หลักการ mock และขอบเขตความปลอดภัย

1. **ไม่เรียก production:** ชุดนี้ออกแบบให้ไม่ต้องมี Supabase จริง, OpenAI จ่ายจริง, หรือ secret จาก production — ใช้ `vi.fn()` / `vi.mock` / `vi.doMock` ตาม scenario
2. **Route handlers:** มักใช้ `vi.resetModules()` ใน `afterEach` และ `dynamic import("./route")` หลัง `vi.doMock(...)` เพื่อให้ dependency ถูกแทนที่ต่อการรัน เหมือนใน `route.test.ts` ที่มีอยู่แล้ว
3. **`vi.hoisted`:** ใช้เมื่อต้องอ้าง mock function เดียวกันทั้งใน `vi.doMock` และ assertion (ลดปัญหา TDZ และลำดับโหลดโมดูล)
4. **Tenant / user id:** อย่ายึดพฤติกรรมจากการที่ client ส่ง tenant id — ใน route จริงต้อง resolve ฝั่งเซิร์ฟเวอร์; เทสต์ใช้ fixture เพื่อจำลองผลหลัง auth ผ่านแล้วเท่านั้น

## ตัวอย่าง pattern การรันเทสต์แบบเจาะไฟล์

```bash
npm run test -- --run src/lib/api/auth.test.ts
npm run test -- --run src/app/api/v2/chat/route.test.ts
```

## ความเกี่ยวข้องกับ regression gate

ชุด minimum ที่ทีมควรผ่านก่อนรับ refactor / merge ครั้งใหญ่ (ตามเอกสาร regression):

```bash
npm run lint
npm run test
npm run build
```

## ช่องว่างที่รู้ไว้ (ยังไม่ใช้ unit doc ครอบ)

- Playwright / E2E เบราว์เซอร์
- สคริปต์สั่งใช้ `tsc --noEmit` แบบ `npm run typecheck`
- รายงาน coverage จาก Vitest
- เทสต์ security เชิงข้าม-tenant และ endpoint อื่น ๆ ตาม backlog ใน `regression-test-document.md`

เมื่อเพิ่มไฟล์ `*.test.ts` ใหม่ ควรบรรทึกประโยชน์หลักของไฟล์นั้นเป็น bullet ใน section **รายการ unit tests** ด้านบน (หรืออัปเดตเป็นรายการอัตโนมัติจาก script ภายหลังได้)
