import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { PlatformTenantNav } from "@/components/admin/platform-tenant-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { tenantManagementData } from "@/lib/services/adminDataService";

export default async function PlatformTenantSafetyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await tenantManagementData(id);
  const settings = data?.escalation;

  return (
    <>
      <Button asChild variant="ghost" className="mb-4">
        <Link href={`/platform/tenants/${id}`}><ArrowLeft className="h-4 w-4" /> Back to tenant</Link>
      </Button>
      <PageHeader title="Tenant Safety & Handoff" description="Escalation setup and crisis handoff status for this tenant." />
      <PlatformTenantNav tenantId={id} active="/safety" />
      <Card>
        <CardHeader>
          <CardTitle>{settings?.enabled ? "Escalation Enabled" : "Escalation Disabled"}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm md:grid-cols-2">
          {[
            ["HR Email", settings?.hr_contact_email],
            ["Counselor Email", settings?.counselor_contact_email],
            ["Handoff URL", settings?.handoff_url],
            ["Button Text", settings?.handoff_button_text],
            ["Notify on High", settings?.notify_on_high ? "Yes" : "No"],
            ["Notify on Crisis", settings?.notify_on_crisis === false ? "No" : "Yes"],
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
