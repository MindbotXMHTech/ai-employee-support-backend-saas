import { MetricCard } from "@/components/admin/metric-card";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listTenantsWithMetrics, platformOverview } from "@/lib/services/adminDataService";
import { formatCurrency } from "@/lib/utils";

export default async function PlatformUsagePage() {
  const [overview, tenants] = await Promise.all([platformOverview(), listTenantsWithMetrics()]);

  return (
    <>
      <PageHeader title="Platform Usage" description="Aggregate usage and cost across all tenant workspaces." />
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard title="Total Tenants" value={overview?.totalTenants ?? 0} />
        <MetricCard title="Active Tenants" value={overview?.activeTenants ?? 0} />
        <MetricCard title="Total AI Cost" value={formatCurrency(overview?.totalCost ?? 0)} />
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Tenant Usage Detail</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Messages</TableHead>
                <TableHead>Limit</TableHead>
                <TableHead>Documents</TableHead>
                <TableHead>Estimated Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((tenant) => (
                <TableRow key={tenant.id}>
                  <TableCell className="font-medium">{tenant.name}</TableCell>
                  <TableCell>{tenant.messagesUsed}</TableCell>
                  <TableCell>{tenant.monthly_message_limit}</TableCell>
                  <TableCell>{tenant.documentsCount}</TableCell>
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
