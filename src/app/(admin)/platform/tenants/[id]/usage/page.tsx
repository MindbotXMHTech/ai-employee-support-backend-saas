import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MetricCard } from "@/components/admin/metric-card";
import { PageHeader } from "@/components/admin/page-header";
import { PlatformTenantNav } from "@/components/admin/platform-tenant-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { tenantManagementData } from "@/lib/services/adminDataService";
import { formatCurrency } from "@/lib/utils";

export default async function PlatformTenantUsagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await tenantManagementData(id);

  return (
    <>
      <Button asChild variant="ghost" className="mb-4">
        <Link href={`/platform/tenants/${id}`}><ArrowLeft className="h-4 w-4" /> Back to tenant</Link>
      </Button>
      <PageHeader title="Tenant Usage & Cost" description="Current month usage for this tenant only." />
      <PlatformTenantNav tenantId={id} active="/usage" />
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard title="Messages" value={data ? `${data.quota.used}/${data.quota.limit}` : "0/0"} />
        <MetricCard title="Input Tokens" value={data?.usage.inputTokens ?? 0} />
        <MetricCard title="Output Tokens" value={data?.usage.outputTokens ?? 0} />
        <MetricCard title="Estimated Cost" value={formatCurrency(data?.usage.estimatedCostUsd ?? 0)} />
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Request Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {Object.entries(data?.usage.byType ?? {}).map(([type, count]) => (
            <div key={type} className="rounded-lg border border-slate-200 p-3">
              <p className="text-sm text-slate-500">{type}</p>
              <p className="text-xl font-semibold">{count}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
