import { MetricCard } from "@/components/admin/metric-card";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTenantForAdmin } from "@/lib/auth/admin";
import { tenantDashboardData } from "@/lib/services/adminDataService";
import { formatCurrency } from "@/lib/utils";

export default async function UsagePage() {
  const data = await tenantDashboardData(await getTenantForAdmin());
  return (
    <>
      <PageHeader title="Usage & Cost" description="ข้อความ token model usage และ estimated cost สำหรับรอบเดือนปัจจุบัน" />
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard title="Messages" value={data ? `${data.quota.used}/${data.quota.limit}` : "0/0"} />
        <MetricCard title="Input Tokens" value={data?.usage.inputTokens ?? 0} />
        <MetricCard title="Output Tokens" value={data?.usage.outputTokens ?? 0} />
        <MetricCard title="Estimated Cost" value={formatCurrency(data?.usage.estimatedCostUsd ?? 0)} />
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Message Type Breakdown</CardTitle>
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
