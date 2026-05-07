import Link from "next/link";
import { PlatformAdminSetupForm } from "@/components/admin/platform-admin-setup-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function PlatformAdminSetupPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create First Platform Admin</CardTitle>
          <CardDescription>
            Use this once to create the SaaS owner account. After a platform admin exists, this setup endpoint is locked.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PlatformAdminSetupForm />
          <p className="mt-4 text-center text-sm text-slate-500">
            Already created?{" "}
            <Link href="/login" className="font-medium text-slate-950">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
