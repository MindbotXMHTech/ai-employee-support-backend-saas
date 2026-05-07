import Link from "next/link";
import { CreateTenantForm } from "@/components/admin/create-tenant-form";
import { DeleteTenantButton } from "@/components/admin/delete-tenant-button";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listTenantsWithMetrics } from "@/lib/services/adminDataService";
import { formatCurrency } from "@/lib/utils";

export default async function TenantsPage() {
  const tenants = await listTenantsWithMetrics();
  return (
    <>
      <PageHeader
        title="Tenant Management"
        description="มุมมองรวมทุก tenant สำหรับ platform admin พร้อมแยกเข้าไปจัดการ tenant รายตัว"
      />
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Create Tenant Workspace</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateTenantForm />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Workspace ID</TableHead>
                <TableHead>Company Code</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Documents</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Manage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((tenant) => (
                <TableRow key={tenant.id}>
                  <TableCell className="font-medium">{tenant.name}</TableCell>
                  <TableCell>{tenant.slug}</TableCell>
                  <TableCell className="font-mono">{tenant.companyCode ?? "-"}</TableCell>
                  <TableCell><Badge>{tenant.plan}</Badge></TableCell>
                  <TableCell><Badge variant={tenant.status === "active" ? "success" : "warning"}>{tenant.status}</Badge></TableCell>
                  <TableCell>{tenant.messagesUsed}/{tenant.monthly_message_limit}</TableCell>
                  <TableCell>{tenant.documentsCount}</TableCell>
                  <TableCell>{formatCurrency(tenant.estimatedCostUsd)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/platform/tenants/${tenant.id}`}>Open</Link>
                      </Button>
                      <DeleteTenantButton tenantId={tenant.id} tenantName={tenant.name} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
