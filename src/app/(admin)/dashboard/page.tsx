import { EmptyState } from "@/components/admin/empty-state";
import { MetricCard } from "@/components/admin/metric-card";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getTenantForAdmin } from "@/lib/auth/admin";
import { tenantDashboardData } from "@/lib/services/adminDataService";
import { formatCurrency } from "@/lib/utils";

export default async function TenantDashboardPage() {
  const tenantId = await getTenantForAdmin();
  const data = await tenantDashboardData(tenantId);

  if (!data) {
    return (
      <>
        <PageHeader title="Tenant Overview" description="Connect Supabase and sign in as a tenant admin to view business-level tenant data." />
        <EmptyState title="No tenant selected" description="Create a tenant and tenant admin membership to activate this dashboard." />
      </>
    );
  }

  const trialDays = data.tenant.trial_ends_at
    ? Math.max(Math.ceil((new Date(data.tenant.trial_ends_at).getTime() - new Date().getTime()) / 86_400_000), 0)
    : null;

  return (
    <>
      <PageHeader title="Tenant Overview" description="ภาพรวมสำหรับ company admin: การใช้งาน สิทธิ์คงเหลือ เอกสารบริษัท และ conversation ล่าสุด" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Current Package" value={data.tenant.plan.toUpperCase()} description={`Workspace is ${data.tenant.status}`} />
        <MetricCard title="Messages Remaining" value={data.quota.remaining} description={`${data.quota.used} used from ${data.quota.limit}`} />
        <MetricCard title="Monthly AI Cost" value={formatCurrency(data.usage.estimatedCostUsd)} description="Estimated for this company" />
        <MetricCard title="Company Documents" value={`${data.readyDocuments ?? 0}/${data.documentsCount ?? 0}`} description="Ready for employee answers" />
      </div>
      {trialDays !== null ? <Badge className="mt-4" variant="warning">{trialDays} trial days remaining</Badge> : null}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Safety Alerts</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{data.safetyAlerts ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent Conversations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.conversations.length ? (
              data.conversations.map((conversation) => (
                <div key={conversation.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                  <p className="font-medium">{conversation.title ?? conversation.external_conversation_id ?? conversation.id}</p>
                  <p className="text-slate-500">{conversation.channel}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No conversations yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
