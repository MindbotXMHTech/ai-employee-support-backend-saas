import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/auth/admin";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const currentUser = await getCurrentAppUser();

  if (!currentUser) {
    redirect("/login?next=/platform");
  }

  if (currentUser.appUser.role !== "platform_admin") {
    redirect("/dashboard");
  }

  return children;
}
