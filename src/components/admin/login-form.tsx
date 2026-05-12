"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Native HTML forms default to GET; if JS fails (e.g. dev assets blocked via ngrok), credentials
  // end up in the URL. Strip them and keep only ?next= for safety.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("email") && !params.has("password")) return;
    const next = params.get("next");
    const qs = next?.startsWith("/") ? `?next=${encodeURIComponent(next)}` : "";
    window.history.replaceState(null, "", `${window.location.pathname}${qs}`);
  }, []);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitLogin(event);
  }

  async function submitLogin(event: React.FormEvent<HTMLFormElement>) {
    setLoading(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: String(form.get("email")),
        password: String(form.get("password")),
      });
      if (signInError) throw signInError;

      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: appUser } = await supabase
        .from("users")
        .select("role")
        .eq("auth_user_id", user?.id)
        .maybeSingle();

      const fallback = appUser?.role === "platform_admin" ? "/platform" : "/dashboard";
      const destination =
        nextPath && nextPath.startsWith(appUser?.role === "platform_admin" ? "/platform" : "/dashboard")
          ? nextPath
          : fallback;

      router.push(destination);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form method="post" onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" placeholder="admin@company.com" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      <Button className="w-full" type="submit" disabled={loading}>
        {loading ? "Signing in..." : "Sign in"}
      </Button>
      {process.env.NODE_ENV === "development" ? (
        <p className="text-center text-xs text-slate-500">
          Local Supabase seed: <span className="font-mono">platform-admin@local.dev</span> /{" "}
          <span className="font-mono">LocalDev123!</span> — see README.
        </p>
      ) : null}
    </form>
  );
}
