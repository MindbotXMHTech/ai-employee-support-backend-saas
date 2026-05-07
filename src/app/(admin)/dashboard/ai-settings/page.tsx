import { redirect } from "next/navigation";

export default async function AiSettingsPage() {
  redirect("/dashboard/settings");
}
