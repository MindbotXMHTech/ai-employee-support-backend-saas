import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { PlatformTenantNav } from "@/components/admin/platform-tenant-nav";
import { WorkflowTokensManager } from "@/components/admin/workflow-tokens-manager";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { tenantManagementData } from "@/lib/services/adminDataService";

export default async function PlatformTenantWorkflowTokensPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await tenantManagementData(id);

  if (!data) {
    return (
      <>
        <Button asChild variant="ghost" className="mb-4">
          <Link href="/platform/tenants"><ArrowLeft className="h-4 w-4" /> Back to tenants</Link>
        </Button>
        <PageHeader title="Tenant not found" description="This tenant could not be loaded." />
      </>
    );
  }

  return (
    <>
      <Button asChild variant="ghost" className="mb-4">
        <Link href={`/platform/tenants/${id}`}><ArrowLeft className="h-4 w-4" /> Back to tenant</Link>
      </Button>
      <PageHeader
        title="Workflow HTTP tokens"
        description="Stored per tenant. POST /api/v2/chat does not accept these tokens. That route requires the x-central-bot-secret header."
      />
      <PlatformTenantNav tenantId={id} active="/workflow-tokens" />
      <Card>
        <CardHeader>
          <CardTitle>Tokens for this tenant</CardTitle>
          <CardDescription>
            Create a token and copy it once. Revoke it if it leaks. POST /api/v2/chat does not read this token.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WorkflowTokensManager tenantId={id} initialTokens={data.workflowTokens} />
        </CardContent>
      </Card>
    </>
  );
}
