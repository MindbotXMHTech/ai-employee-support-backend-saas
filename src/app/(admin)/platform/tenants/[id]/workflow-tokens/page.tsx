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
        description="Tokens for automation tools that cannot send x-central-bot-secret as a header. Use workflow_token in POST /api/v1/chat JSON."
      />
      <PlatformTenantNav tenantId={id} active="/workflow-tokens" />
      <Card>
        <CardHeader>
          <CardTitle>Tokens for this tenant</CardTitle>
          <CardDescription>
            Create a token, copy it once into your workflow (e.g. Make, n8n). Revoke if it leaks. Same tenant isolation rules as company codes apply when linking users.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WorkflowTokensManager tenantId={id} initialTokens={data.workflowTokens} />
        </CardContent>
      </Card>
    </>
  );
}
