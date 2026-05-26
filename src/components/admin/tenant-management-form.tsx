"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function deriveQuotaStatusLabel(monthlyMessageLimit: number): string {
  return monthlyMessageLimit > 0 ? "Active (has quota)" : "No quota (suspended)";
}

export function TenantManagementForm({
  tenant,
}: {
  tenant: {
    id: string;
    name: string;
    plan: string;
    status: string;
    monthly_message_limit: number;
    storage_limit_mb: number;
    max_files: number;
  };
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const payload = {
      storage_limit_mb: Number(form.get("storage_limit_mb")),
      max_files: Number(form.get("max_files")),
    };

    const response = await fetch(`/api/admin/tenants/${tenant.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);
    if (!response.ok) {
      const result = await response.json().catch(() => null);
      setMessage(result?.error ?? "Unable to update tenant.");
      return;
    }

    setMessage("Operational settings updated.");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <Label>Tenant Name</Label>
        <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">{tenant.name}</p>
        <p className="text-xs text-slate-500">Managed by Mindbloom partner sync.</p>
      </div>
      <div className="space-y-2">
        <Label>Plan</Label>
        <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">Managed by Mindbloom</p>
      </div>
      <div className="space-y-2">
        <Label>Status</Label>
        <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          {deriveQuotaStatusLabel(tenant.monthly_message_limit)}
        </p>
      </div>
      <div className="space-y-2">
        <Label>Message Limit (quota)</Label>
        <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          {tenant.monthly_message_limit.toLocaleString()} / month
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="storage_limit_mb">Storage MB</Label>
        <Input id="storage_limit_mb" name="storage_limit_mb" type="number" defaultValue={tenant.storage_limit_mb} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="max_files">Max Files</Label>
        <Input id="max_files" name="max_files" type="number" defaultValue={tenant.max_files} />
      </div>
      {message ? <p className="text-sm text-slate-500 sm:col-span-2">{message}</p> : null}
      <Button className="sm:col-span-2" type="submit" disabled={loading}>
        {loading ? "Saving..." : "Save Operational Settings"}
      </Button>
    </form>
  );
}
