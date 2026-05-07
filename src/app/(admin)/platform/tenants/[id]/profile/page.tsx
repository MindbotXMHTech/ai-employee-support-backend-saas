import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { PlatformTenantNav } from "@/components/admin/platform-tenant-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { tenantManagementData } from "@/lib/services/adminDataService";

export default async function PlatformTenantProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await tenantManagementData(id);

  return (
    <>
      <Button asChild variant="ghost" className="mb-4">
        <Link href={`/platform/tenants/${id}`}><ArrowLeft className="h-4 w-4" /> Back to tenant</Link>
      </Button>
      <PageHeader title="Company Profile" description="ข้อมูลบริษัทและ contact ที่ AI ใช้อ้างอิงใน tenant นี้" />
      <PlatformTenantNav tenantId={id} active="/profile" />
      <Card>
        <CardHeader>
          <CardTitle>{data?.profile?.company_name ?? data?.tenant.name ?? "Company"}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm md:grid-cols-2">
          {[
            ["Industry", data?.profile?.industry],
            ["HR Contact", data?.profile?.hr_contact_email],
            ["Support Contact", data?.profile?.support_contact_info],
            ["Emergency Contact", data?.profile?.emergency_contact_info],
            ["Default Language", data?.profile?.default_language],
            ["Disclaimer", data?.profile?.disclaimer_text],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-slate-500">{label}</p>
              <p className="font-medium text-slate-950">{value || "Not set"}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
