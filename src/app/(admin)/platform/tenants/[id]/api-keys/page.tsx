import { redirect } from "next/navigation";

export default async function PlatformTenantApiKeysPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/platform/tenants/${id}/employees`);
}
