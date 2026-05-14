"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectNative } from "@/components/ui/select-native";

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
      name: String(form.get("name")),
      plan: String(form.get("plan")),
      status: String(form.get("status")),
      monthly_message_limit: Number(form.get("monthly_message_limit")),
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

    setMessage("Tenant updated.");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="name">Tenant Name</Label>
        <Input id="name" name="name" defaultValue={tenant.name} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="plan">Plan</Label>
        <SelectNative id="plan" name="plan" defaultValue={tenant.plan}>
          <option value="free">Free</option>
          <option value="trial">Trial - 35 days / 500 messages</option>
          <option value="pro">Pro - 30,000 messages/month</option>
        </SelectNative>
      </div>
      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <SelectNative id="status" name="status" defaultValue={tenant.status}>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="expired">Expired</option>
        </SelectNative>
      </div>
      <div className="space-y-2">
        <Label htmlFor="monthly_message_limit">Message Limit</Label>
        <Input id="monthly_message_limit" name="monthly_message_limit" type="number" defaultValue={tenant.monthly_message_limit} />
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
        {loading ? "Saving..." : "Save Tenant Settings"}
      </Button>
    </form>
  );
}
