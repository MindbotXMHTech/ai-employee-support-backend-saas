"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SetupResult {
  appUser: {
    email: string;
    display_name: string | null;
  };
  temporaryPassword: string;
}

export function PlatformAdminSetupForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SetupResult | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setLoading(true);
    setError(null);
    setResult(null);

    const form = new FormData(formElement);
    const response = await fetch("/api/setup/platform-admin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: String(form.get("email")),
        display_name: String(form.get("display_name")),
      }),
    });

    setLoading(false);
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setError(data?.error ?? "Unable to create platform admin.");
      return;
    }

    setResult(data);
    formElement.reset();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="display_name">Platform Admin Name</Label>
        <Input id="display_name" name="display_name" placeholder="Platform Owner" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Platform Admin Email</Label>
        <Input id="email" name="email" type="email" placeholder="owner@example.com" required />
      </div>
      {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {result ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Platform admin created. Copy this temporary password now.</p>
          <p>Email: {result.appUser.email}</p>
          <p className="font-mono">Temporary password: {result.temporaryPassword}</p>
          <Button asChild className="mt-4" variant="outline">
            <Link href="/login">Go to login</Link>
          </Button>
        </div>
      ) : null}
      <Button className="w-full" type="submit" disabled={loading}>
        {loading ? "Creating..." : "Create Platform Admin"}
      </Button>
    </form>
  );
}
