import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/auth/admin";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const currentUser = await getCurrentAppUser();

  if (!currentUser) {
    redirect("/login?next=/dashboard");
  }

  if (currentUser.appUser.role === "platform_admin") {
    redirect("/platform");
  }

  return children;
}
