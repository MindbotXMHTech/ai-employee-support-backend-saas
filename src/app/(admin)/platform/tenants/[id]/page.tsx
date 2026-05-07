import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DeleteTenantButton } from "@/components/admin/delete-tenant-button";
import { MetricCard } from "@/components/admin/metric-card";
import { PageHeader } from "@/components/admin/page-header";
import { PlatformTenantNav } from "@/components/admin/platform-tenant-nav";
import { TenantManagementForm } from "@/components/admin/tenant-management-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { tenantManagementData } from "@/lib/services/adminDataService";
import { formatBytes, formatCurrency } from "@/lib/utils";

export default async function TenantManagementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await tenantManagementData(id);

  if (!data) {
    return (
      <>
        <Button asChild variant="ghost" className="mb-4">
          <Link href="/platform/tenants"><ArrowLeft className="h-4 w-4" /> Back to tenants</Link>
        </Button>
        <PageHeader title="Tenant not found" description="This tenant could not be loaded from Supabase." />
      </>
    );
  }

  const storageUsed = data.documents.reduce((sum, document) => sum + Number(document.file_size_bytes ?? 0), 0);

  return (
    <>
      <Button asChild variant="ghost" className="mb-4">
        <Link href="/platform/tenants"><ArrowLeft className="h-4 w-4" /> Back to tenants</Link>
      </Button>
      <PageHeader
        title={data.tenant.name}
        description="Tenant control center สำหรับ platform admin: สถานะ plan quota และ operational health ของบริษัทนี้"
      />
      <PlatformTenantNav tenantId={id} active="overview" />

      <div className="mb-6 flex flex-wrap gap-2">
        <Badge>{data.tenant.plan}</Badge>
        <Badge variant={data.tenant.status === "active" ? "success" : "warning"}>{data.tenant.status}</Badge>
        <Badge variant="secondary">{data.tenant.slug}</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="Messages" value={`${data.quota.used}/${data.quota.limit}`} description={`${data.quota.remaining} remaining`} />
        <MetricCard title="Estimated Cost" value={formatCurrency(data.usage.estimatedCostUsd)} description="Current month" />
        <MetricCard title="Employee Links" value={data.employeeLinksCount ?? 0} description="Registered users" />
        <MetricCard title="Documents" value={data.documents.length} description={`Max ${data.tenant.max_files}`} />
        <MetricCard title="Storage Used" value={formatBytes(storageUsed)} description={`${data.tenant.storage_limit_mb} MB limit`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Company Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-slate-500">Company</p>
              <p className="font-medium">{data.profile?.company_name ?? data.tenant.name}</p>
            </div>
            <div>
              <p className="text-slate-500">Industry</p>
              <p className="font-medium">{data.profile?.industry ?? "Not set"}</p>
            </div>
            <div>
              <p className="text-slate-500">HR Contact</p>
              <p className="font-medium">{data.profile?.hr_contact_email ?? "Not set"}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tenant Controls</CardTitle>
          </CardHeader>
          <CardContent>
            <TenantManagementForm tenant={data.tenant} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Operational Sections</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {[
              ["AI Settings", `/platform/tenants/${id}/ai-settings`],
              ["Knowledge Base", `/platform/tenants/${id}/knowledge-base`],
              ["Employee Links", `/platform/tenants/${id}/employees`],
              ["Conversations", `/platform/tenants/${id}/conversations`],
            ].map(([label, href]) => (
              <Button key={href} asChild variant="outline">
                <Link href={href}>{label}</Link>
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Central Bot Tenant Resolution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <p>This company does not need its own bot API key. The central chatbot uses one platform secret.</p>
            <p>Employees are linked to this tenant by company code on first use, then by channel user ID on future messages.</p>
            <Button asChild variant="outline">
              <Link href={`/platform/tenants/${id}/employees`}>View Employee Links</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 border-red-200">
        <CardHeader>
          <CardTitle className="text-red-700">Danger Zone</CardTitle>
          <CardDescription>
            ลบ tenant นี้และข้อมูลที่เกี่ยวข้องทั้งหมดอย่างถาวร รวมถึง company admin ที่ไม่ได้อยู่ tenant อื่น ไม่สามารถกู้คืนได้
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteTenantButton
            tenantId={data.tenant.id}
            tenantName={data.tenant.name}
            redirectTo="/platform/tenants"
            variant="destructive"
            size="default"
            label="Delete this tenant"
          />
        </CardContent>
      </Card>
    </>
  );
}
