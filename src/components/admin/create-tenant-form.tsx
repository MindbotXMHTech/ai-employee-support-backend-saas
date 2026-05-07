"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectNative } from "@/components/ui/select-native";
import { Textarea } from "@/components/ui/textarea";

interface CreatedTenantResult {
  tenant: {
    id: string;
    name: string;
    slug: string;
    plan: string;
  };
  adminUser: {
    email: string;
    display_name: string | null;
  };
  companyCode: {
    code: string;
  };
  temporaryPassword: string;
}

export function CreateTenantForm() {
  const router = useRouter();
  const [created, setCreated] = useState<CreatedTenantResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setLoading(true);
    setError(null);
    setCreated(null);

    const form = new FormData(formElement);
    const payload = {
      name: String(form.get("name")),
      plan: String(form.get("plan")),
      industry: String(form.get("industry") ?? ""),
      company_description: String(form.get("company_description") ?? ""),
      hr_contact_name: String(form.get("hr_contact_name") ?? ""),
      hr_contact_email: String(form.get("hr_contact_email") ?? ""),
      admin_email: String(form.get("admin_email")),
      admin_display_name: String(form.get("admin_display_name")),
    };

    const response = await fetch("/api/admin/tenants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      setError(result?.error ?? "Unable to create tenant.");
      return;
    }

    setCreated(result);
    router.refresh();
    formElement.reset();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <div className="space-y-2">
        <Label htmlFor="name">Company Name</Label>
        <Input id="name" name="name" placeholder="ABC Company" required />
        <p className="text-xs text-slate-500">Workspace ID is generated automatically.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="plan">Plan</Label>
        <SelectNative id="plan" name="plan" defaultValue="trial">
          <option value="trial">Trial - 7 days / 500 messages</option>
          <option value="pro">Pro - 30,000 messages/month</option>
        </SelectNative>
      </div>
      <div className="space-y-2">
        <Label htmlFor="industry">Industry</Label>
        <Input id="industry" name="industry" placeholder="Technology, Retail, Healthcare" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="hr_contact_name">HR Contact Name</Label>
        <Input id="hr_contact_name" name="hr_contact_name" placeholder="HR Manager" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="hr_contact_email">HR Contact Email</Label>
        <Input id="hr_contact_email" name="hr_contact_email" type="email" placeholder="hr@company.com" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="admin_display_name">Company Admin Name</Label>
        <Input id="admin_display_name" name="admin_display_name" placeholder="Somchai Admin" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="admin_email">Company Admin Email</Label>
        <Input id="admin_email" name="admin_email" type="email" placeholder="admin@company.com" required />
      </div>
      <div className="space-y-2 md:col-span-2 xl:col-span-3">
        <Label htmlFor="company_description">Company Description</Label>
        <Textarea id="company_description" name="company_description" placeholder="Short company context for the AI assistant" />
      </div>
      {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 md:col-span-2 xl:col-span-3">{error}</p> : null}
      {created ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 md:col-span-2 xl:col-span-3">
          <p className="font-semibold">Tenant created. Show this temporary password once.</p>
          <p>Company: {created.tenant.name}</p>
          <p>Workspace ID: {created.tenant.slug}</p>
          <p className="font-mono">Company code: {created.companyCode.code}</p>
          <p>Admin email: {created.adminUser.email}</p>
          <p className="font-mono">Temporary password: {created.temporaryPassword}</p>
        </div>
      ) : null}
      <Button className="md:col-span-2 xl:col-span-3" type="submit" disabled={loading}>
        {loading ? "Creating..." : "Create Tenant and Company Admin"}
      </Button>
    </form>
  );
}
