"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectNative } from "@/components/ui/select-native";

const categories = [
  ["benefits", "Benefits"],
  ["welfare", "Welfare"],
  ["leave_policy", "Leave Policy"],
  ["insurance", "Insurance"],
  ["hr_faq", "HR FAQ"],
  ["other", "Other"],
] as const;

export function DocumentUploadForm({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    formData.set("tenant_id", tenantId);

    setLoading(true);
    setMessage(null);
    const response = await fetch("/api/admin/documents", {
      method: "POST",
      body: formData,
    });
    setLoading(false);

    if (!response.ok) {
      const result = await response.json().catch(() => null);
      setMessage(result?.error ?? "Unable to upload document.");
      return;
    }

    setMessage("Document uploaded and processed.");
    formElement.reset();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-3">
      <input type="hidden" name="tenant_id" value={tenantId} />
      <div className="space-y-2">
        <Label htmlFor={`file-${tenantId}`}>File</Label>
        <Input id={`file-${tenantId}`} name="file" type="file" accept=".pdf,.docx,.txt,.md" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`document_category-${tenantId}`}>Category</Label>
        <SelectNative id={`document_category-${tenantId}`} name="document_category" defaultValue="hr_faq">
          {categories.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </SelectNative>
      </div>
      <div className="flex items-end">
        <Button type="submit" disabled={loading}>
          {loading ? "Processing..." : "Upload & Process"}
        </Button>
      </div>
      {message ? <p className="text-sm text-slate-500 md:col-span-3">{message}</p> : null}
    </form>
  );
}
