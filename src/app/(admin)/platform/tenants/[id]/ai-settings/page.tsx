import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PlatformAiSettingsForm } from "@/components/admin/platform-ai-settings-form";
import { PageHeader } from "@/components/admin/page-header";
import { PlatformTenantNav } from "@/components/admin/platform-tenant-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getModelPricingOptions, getTenantAiSettings } from "@/lib/services/platformAiSettingsService";
import { tenantManagementData } from "@/lib/services/adminDataService";

export default async function PlatformTenantAiSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [tenantData, settings, modelOptions] = await Promise.all([
    tenantManagementData(id),
    getTenantAiSettings(id),
    getModelPricingOptions(),
  ]);
  const selectableModels = Array.from(
    new Set([
      ...modelOptions,
      settings.general_model,
      settings.rag_model,
      settings.safety_model,
      settings.embedding_model,
    ]),
  );

  return (
    <>
      <Button asChild variant="ghost" className="mb-4">
        <Link href={`/platform/tenants/${id}`}><ArrowLeft className="h-4 w-4" /> Back to tenant</Link>
      </Button>
      <PageHeader
        title={`${tenantData?.tenant.name ?? "Tenant"} AI Settings`}
        description="Platform-admin managed AI behavior for this tenant. Tenant admins cannot edit or see these settings."
      />
      <PlatformTenantNav tenantId={id} active="/ai-settings" />
      <Card>
        <CardHeader>
          <CardTitle>Tenant AI Configuration</CardTitle>
          <CardDescription>
            Use this to customize answers, model routing, feature flags, and prompt behavior for this company only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PlatformAiSettingsForm
            settings={settings}
            modelOptions={selectableModels}
            actionPath={`/api/admin/tenants/${id}/ai-settings`}
            submitLabel="Save Tenant AI Settings"
          />
        </CardContent>
      </Card>
    </>
  );
}
