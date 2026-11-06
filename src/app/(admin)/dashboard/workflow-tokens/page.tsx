import { PageHeader } from "@/components/admin/page-header";
import { WorkflowTokensManager } from "@/components/admin/workflow-tokens-manager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getTenantForAdmin } from "@/lib/auth/admin";
import { listWorkflowTokens } from "@/lib/services/workflowTokenService";

export default async function DashboardWorkflowTokensPage() {
  const tenantId = await getTenantForAdmin();
  if (!tenantId) {
    return <PageHeader title="Workflow HTTP tokens" description="No company tenant is linked to your account." />;
  }

  const tokens = await listWorkflowTokens(tenantId);

  return (
    <>
      <PageHeader
        title="Workflow HTTP tokens"
        description="Stored for this company. POST /api/v2/chat does not accept these tokens. That route requires the x-central-bot-secret header."
      />
      <Card>
        <CardHeader>
          <CardTitle>Your company tokens</CardTitle>
          <CardDescription>
            Each token is scoped to your tenant only. Store the raw value securely; it is shown only once at creation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WorkflowTokensManager tenantId={tenantId} initialTokens={tokens} />
        </CardContent>
      </Card>
    </>
  );
}
