import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/components/admin/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Admin Login</CardTitle>
          <CardDescription>Use Supabase Auth credentials to access your dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm nextPath={params.next} />
          <p className="mt-4 text-center text-sm text-slate-500">
            First time setup?{" "}
            <Link href="/setup/platform-admin" className="font-medium text-slate-950">
              Create platform admin
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
