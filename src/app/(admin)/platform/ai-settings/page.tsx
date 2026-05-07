import { redirect } from "next/navigation";

export default async function PlatformAiSettingsPage() {
  redirect("/platform/tenants");
}
