# Security concerns (สรุปความเสี่ยง)

เอกสารนี้อ้างอิงจากการไล่อ่านโค้ดในโปรเจกต์ (API routes, auth helpers, services เกี่ยวข้อง) — ไม่ใช่การ pentest เต็มรูปแบบ ควรผูกกับ backlog จาก [`regression-test-document.md`](./regression-test-document.md) §Security Regression Coverage และอัปเดตเมื่อมีการเปลี่ยนแปลงสำคัญ

## Legend

| Risk level | ความหมายโดยย่อ |
|------------|-----------------|
| **Critical** | ต้องแก้/ล็อกก่อนขึ้น production ที่เปิดให้เข้าจากเน็ตสาธารณะ เว้นแต่มีมาตรการชัดเจนอย่างอื่น |
| **High** | cross-tenant, privilege ผิดความถูกต้องของตัวตน, secret misconfig ใน prod |
| **Medium** | รั่วข้อมูลผ่าน error, abuse/rate,cost,policy เรื่อง LLM/RAG |
| **Low** | defense ที่ดีอยู่แล้ว / edge case /ควรติดตาม |

---

## Critical

### 1. Bootstrap platform admin (`POST /api/setup/platform-admin`)

**สถานะล่าสุด (mitigation ในโค้ด):** ถ้าตั้ง `PLATFORM_SETUP_SECRET` ใน environment แล้ว ระบบบังคับให้มีค่านี้ตรงกับ **`setup_secret`** ใน JSON **หรือ** header **`x-platform-setup-secret`** (เทียบแบบ timing-safe) ถ้ามิฉะนั้นได้ `403`. ถ้า **ไม่** ตั้งตัวแปรนี้ พฤติกรรมเหมือนเดิมสำหรับ local/first-boot ที่เชื่อ network

**แนะนำใน production:** สร้างค่าลับด้วย `npm run secrets:platform-setup` แล้วใส่ใน env ของโฮสต์ (อย่านำไปประกอบใน frontend)

**อ้างอิงโค้ด:** `src/app/api/setup/platform-admin/route.ts`, `src/lib/setup/platformSetupAuth.ts`

### 2. Revoke API key ข้าม tenant (`DELETE /api/admin/api-keys/[id]`)

**สถานะล่าสุด (mitigation ในโค้ด):** ดึง `tenant_id` ของ key ก่อน; **platform_admin** เพิกถอนได้; **tenant_admin** เพิกถอนได้เฉพาะเมื่อเป็นสมาชิก active ของ `tenant_members` สำหรับ tenant นั้น (ใช้ `canManageTenantScopedResource` เดียวกับเอกสาร)

**ความเสี่ยงคงเหลือ:** key ที่ไม่มีอยู่คืน `404` (เดิมอาจ error จาก DB) — ถือว่าเหมาะสมทางความปลอดภัย

**อ้างอิงโค้ด:** `src/app/api/admin/api-keys/[id]/route.ts`, `src/lib/auth/tenantScopedAccess.ts`

---

## High

### 3. Client เลือก `tenant_id` ได้บน playground และการสร้าง API keys

**พฤติกรรม:** `POST /api/admin/playground` และ `POST /api/admin/api-keys` ใช้ `tenant_id` จาก payload ภายใต้ `requireAdminUser` เพียงอย่างเดียว

**ความเสี่ยง:** Tenant admin (ไม่ใช่ platform เท่านั้น) อาจส่ง UUID ของ tenant อื่น → เล่น RAG/context ของอีกที่, เปิดโอกาส burn quota/cost และสร้าง key แทนบริษัทอื่นได้

**เทียบ:** การอัปโหลดเอกสารมี `canManageTenantDocuments()` อยู่แล้ว (`src/app/api/admin/documents/route.ts`)

### 4. Secret ที่ optional และ default ใน hash API key

**พฤติกรรม:** `API_KEY_SECRET` เป็น optional และมี fallback constant เมื่อ env ว่าง (`apiKeyService.hashApiKey`)

**ความเสี่ยง:** ใน production หากลืมตั้งค่า การเก็บ key hash ผูกกับค่าที่พยายามทำความเข้าใจได้จากโค้ด/สภาพแวดล้อม dev — ความเข้มแข็งของการปกป้อง key เสื่อม

### 5. Central bot secret ไม่ได้บังคับใน schema env

**พฤติกรรม:** `CENTRAL_BOT_SECRET` optional — ฟังก์ชันตรวจที่ใช้กับปลาย central bot จะปฏิเสธทุกเมื่อว่าง (`validateCentralBotSecret`)

**ความเสี่ยง:** ไม่ใช่การ bypass โดยตรง แต่อาจเข้าขั้น ***misconfiguration*** (bot downtime) และความผิดเข้าใจว่ามีความปลอดภัยระดับหนึ่ง — ควร fail-fast ใน production ด้วย health check/deploy validation

### Partner tenant provisioning (`POST /api/v1/partner/tenants`)

**พฤติกรรม:** มีการตรวจ `TENANT_PROVISION_SECRET` กับ header `x-tenant-provision-secret` (timing-safe). ถ้าไม่ตั้ง env เส้นทางนี้ตอบ `503`.

**ความเสี่ยงคงเหลือ:** หากรั่ว provisioning secret ผู้ประสงค์ร้ายสามารถเปิดบริษัทในระบบและได้ **`temporaryPassword` ใน response** — ต้องหมุน secret, เครือข่าย/VPC เชื่อถือได้, rate limit/WAF และรายงาน audit

---

## Medium

### 6. HTTP error body จากข้อความข้อผิดพลาดภายใน

ในหลาย route มีการคืนค่า `error.message` จากการทำงานของ Supabase/Auth ไปใน JSON — เสี่ยง **ข้อมูลรายละเอียดเกินที่จำเป็น** (constraints, เลย์เยอร์ storage)

แนะนำ: ผู้ใช้ได้รับข้อความแบบ generic; เก็บรายละเอียดใน server log พร้อม correlation id  

**ตัวอย่างจุด:** `setup/platform-admin`, `admin/tenants/[id]` (บาง catch/error path), PATCH settings ที่ return `error.message`

### 7. Legacy `x-api-key` เป็นขอบเขตสิทธิ์ใหญ่ของ tenant

เมื่อมี key ที่ผูก tenant อยู่ การใช้งานผ่าน v1 (`authenticateBotRequest`) เป็น **ความเหมือนกับความเข้าถึงทั้งระบบของ tenant นั้น** — governance เรื่อง rotation, revocation, และการติดตามรั่ว key ควรเข้ม

### 8. Rate limiting และค่าใช้จ่ายโมเดล

ไม่เห็นจุดควบคุมอัตราเรียกบนระดับแอปสำหรับ bot/playground/setup — พึ่ง infra (WAF/CDN/API gateway) หรือ Supabase เท่านั้นหากไม่ได้เพิ่มในแอป

### 9. LLM และ RAG (prompt injection / เอกสารไม่ถูกความถูกต้อง)

เอกสารที่อัปโหลดเป็น **untrusted content** — ควรอยู่ใน threat model และ policy product (อย่างที่ AGENTS.md กล่าวไว้) รวมถึงว่าโมเดลไม่ override system instruction เพื่อความครบถ้วนเป็นขั้นความเสี่ยงระดับ product/security

---

## Low (ควรเก็บ / ติดตาม)

### 10. พฤติกรรมที่อยู่ในแนวทางที่ดี

- Central bot secret: ใช้ `crypto.timingSafeEqual` เมื่อความยาวเท่ากัน — `src/lib/services/centralBotService.ts`
- ปลาย central/botไม่ควรไว้ใจ tenant จากข้อความลูกค้าอย่างเดียว — tenant resolve จาก registration / linking
- Tenant-scoped ops เรื่องเอกสาร: มี `canManageTenantDocuments`
- Routes ผู้ช่วย platform-only (เช่น สร้าง/แก้/ลบ tenant, AI tenant settings): มี role check `platform_admin`

### 11. Tenant หลายตัวต่อผู้ใช้

`getTenantForAdmin` ใช้ membership แถวแรก (`memberships?.[0]`) — ในกรณี multi-membership (ถ้ามีในอนาคต) อาจสับสน UX/ความเหมือนกันธรรมรีด — เข้ากลุ่ม Low เรื่อง design

---

## สรุปตาราง

| Risk | Topic |
|------|--------|
| Critical (mitigated เมื่อเปิดใช้) | Bootstrap: ตั้ง `PLATFORM_SETUP_SECRET` บังคับ token; ยังเปิดได้ถ้าไม่ตั้งค่าเช่น dev — API key revoke จำกัดตาม tenant membership + platform_admin |
| High | Arbitrary `tenant_id` บน playground + สร้าง API key; `API_KEY_SECRET` optional + default hash |
| Medium | Detailed errors to client; legacy key blast radius; no in-app rate limit; LLM/RAG threats |
| Low | Timing-safe bot secret good; docs upload checks good; multi-tenant picker edge |

---

## ขั้นตอนที่แนะนำ (ลำดับหยาบ)

1. ผูก `tenant_id` กับ membership สำหรับ playground และ API keys **เมื่อสร้างใหม่**
2. ตั้ง `PLATFORM_SETUP_SECRET` ใน production และหมุนหลัง bootstrap เสร็จ
3. ทำ error response consistency (generic user message)
4. บังคับ `API_KEY_SECRET` และ `CENTRAL_BOT_SECRET` ใน production พร้อม deploy check
5. เติม security regression tests ตามรายการใน `regression-test-document.md`

---

## ความเกี่ยวข้องกับเอกสารอื่น

| เอกสาร | เหตุผล |
|--------|--------|
| [`regression-test-document.md`](./regression-test-document.md) | รายการ security regression targets ที่ยังไม่มีเทส |
| [`unit-testing.md`](./unit-testing.md) | การเพิ่มเทสต์ควรอ้าง behavior จาก doc แถวนี้ |
| `AGENTS.md` | ข้อที่ตั้งใจทางผลิตภัณฑ์เรื่อง tenant isolation และ roles |
