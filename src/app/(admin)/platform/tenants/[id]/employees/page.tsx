import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { PlatformTenantNav } from "@/components/admin/platform-tenant-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ensureCompanyCodeForTenant } from "@/lib/services/companyCodeService";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { tenantManagementData } from "@/lib/services/adminDataService";

async function employeeResolutionData(tenantId: string) {
  const supabase = createSupabaseServiceClient();
  const { data: tenant } = await supabase.from("tenants").select("id, name").eq("id", tenantId).maybeSingle();
  if (tenant) {
    await ensureCompanyCodeForTenant({ tenantId: tenant.id, tenantName: tenant.name });
  }

  const [{ data: codes }, { data: links }] = await Promise.all([
    supabase.from("tenant_company_codes").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
    supabase.from("employee_tenant_links").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(50),
  ]);

  return {
    codes: codes ?? [],
    links: links ?? [],
  };
}

export default async function PlatformTenantEmployeesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [tenantData, resolutionData] = await Promise.all([tenantManagementData(id), employeeResolutionData(id)]);

  return (
    <>
      <Button asChild variant="ghost" className="mb-4">
        <Link href={`/platform/tenants/${id}`}><ArrowLeft className="h-4 w-4" /> Back to tenant</Link>
      </Button>
      <PageHeader
        title="Employee Links"
        description="How the central chatbot knows which company each employee belongs to."
      />
      <PlatformTenantNav tenantId={id} active="/employees" />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Company Codes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-500">
              Share a company code with employees during onboarding. After the first verification, the platform remembers their channel user ID.
            </p>
            {resolutionData.codes.length ? (
              resolutionData.codes.map((code) => (
                <div key={code.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                  <span className="font-mono text-sm">{code.code}</span>
                  <Badge variant={code.status === "active" ? "success" : "secondary"}>{code.status}</Badge>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                No company code yet for {tenantData?.tenant.name ?? "this tenant"}.
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Linked Employees</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>External User</TableHead>
                  <TableHead>Link UUID</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Verified</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resolutionData.links.map((link) => (
                  <TableRow key={link.id}>
                    <TableCell className="font-mono">{link.external_user_id}</TableCell>
                    <TableCell className="font-mono text-xs">{link.id}</TableCell>
                    <TableCell>{link.channel}</TableCell>
                    <TableCell>{link.verified_at}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
