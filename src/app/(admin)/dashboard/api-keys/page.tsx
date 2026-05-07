import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getTenantForAdmin } from "@/lib/auth/admin";
import { ensureCompanyCodeForTenant } from "@/lib/services/companyCodeService";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

async function getTenantCodes(tenantId?: string | null) {
  if (!tenantId) return [];
  const supabase = createSupabaseServiceClient();
  const { data: tenant } = await supabase.from("tenants").select("id, name").eq("id", tenantId).maybeSingle();
  if (tenant) {
    await ensureCompanyCodeForTenant({ tenantId: tenant.id, tenantName: tenant.name });
  }

  const { data } = await supabase
    .from("tenant_company_codes")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export default async function ApiKeysPage() {
  const tenantId = await getTenantForAdmin();
  const codes = await getTenantCodes(tenantId);
  return (
    <>
      <PageHeader title="Bot Access Code" description="รหัสบริษัทสำหรับผูกพนักงานเข้ากับบริษัทนี้ใน central chatbot" />
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>How employees connect</CardTitle>
          <CardDescription>
            พนักงานคุยกับ chatbot กลางตัวเดียวกันทั้งหมด ครั้งแรกให้ส่ง company code เพื่อผูก user กับบริษัทนี้ หลังจากนั้นระบบจำ tenant จาก channel user ID
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-white">{`curl -X POST ${process.env.APP_URL ?? "http://localhost:3000"}/api/v1/chat \\
  -H "x-central-bot-secret: CENTRAL_BOT_SECRET" \\
  -H "content-type: application/json" \\
  -d '{"external_user_id":"line_user_123","channel":"line","company_code":"ABC123","message":"ลาป่วยได้กี่วัน"}'`}</pre>
          <pre className="mt-3 overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-white">{`curl -X POST ${process.env.APP_URL ?? "http://localhost:3000"}/api/v1/register \\
  -H "x-central-bot-secret: CENTRAL_BOT_SECRET" \\
  -H "content-type: application/json" \\
  -d '{"line_user_id":"line_user_123","channel":"line","company_code":"ABC123"}'`}</pre>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Company Codes</CardTitle>
          <CardDescription>Share one of these codes with employees during onboarding.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {codes.map((code) => (
                <TableRow key={code.id}>
                  <TableCell className="font-mono">{code.code}</TableCell>
                  <TableCell><Badge variant={code.status === "active" ? "success" : "secondary"}>{code.status}</Badge></TableCell>
                  <TableCell>{code.created_at}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
