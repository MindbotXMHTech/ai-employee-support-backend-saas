import { MetricCard } from "@/components/admin/metric-card";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { platformOverview } from "@/lib/services/adminDataService";
import { formatCurrency } from "@/lib/utils";

export default async function PlatformOverviewPage() {
  const overview = await platformOverview();
  return (
    <>
      <PageHeader title="Platform Overview" description="ภาพรวม tenant, plan mix, message usage และ estimated AI cost ของ SaaS platform" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="Total Tenants" value={overview?.totalTenants ?? 0} />
        <MetricCard title="Active Tenants" value={overview?.activeTenants ?? 0} />
        <MetricCard title="Trial Tenants" value={overview?.trialTenants ?? 0} />
        <MetricCard title="Pro Tenants" value={overview?.proTenants ?? 0} />
        <MetricCard title="Estimated Cost" value={formatCurrency(overview?.totalCost ?? 0)} />
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Top Tenants This Month</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Messages</TableHead>
                <TableHead>Estimated Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(overview?.topTenants ?? []).map((tenant) => (
                <TableRow key={tenant.id}>
                  <TableCell className="font-medium">{tenant.name}</TableCell>
                  <TableCell><Badge>{tenant.plan}</Badge></TableCell>
                  <TableCell><Badge variant={tenant.status === "active" ? "success" : "warning"}>{tenant.status}</Badge></TableCell>
                  <TableCell>{tenant.messagesUsed}</TableCell>
                  <TableCell>{formatCurrency(tenant.estimatedCostUsd)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
