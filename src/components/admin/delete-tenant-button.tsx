"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ButtonVariant = "outline" | "destructive" | "ghost";
type ButtonSize = "default" | "sm" | "lg";

export function DeleteTenantButton({
  tenantId,
  tenantName,
  redirectTo,
  variant = "outline",
  size = "sm",
  label = "Delete",
}: {
  tenantId: string;
  tenantName: string;
  redirectTo?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const expected = tenantName.trim();
  const canDelete = confirm.trim() === expected && !loading;

  async function handleDelete() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/tenants/${tenantId}`, { method: "DELETE" });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setError(result?.error ?? "Unable to delete tenant.");
        return;
      }
      setOpen(false);
      setConfirm("");
      if (redirectTo) {
        router.push(redirectTo);
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => {
      setOpen(next);
      if (!next) {
        setConfirm("");
        setError(null);
      }
    }}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className="text-red-600 hover:text-red-700">
          <Trash2 className="h-4 w-4" /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Delete tenant</DialogTitle>
        <DialogDescription className="mt-1">
          การลบ tenant จะลบ company profile, AI settings, knowledge base, conversations, usage logs, company codes และ employee links ทั้งหมดอย่างถาวร
          และจะลบ company admin ที่ไม่ได้อยู่ tenant อื่นด้วย ไม่สามารถกู้คืนได้
        </DialogDescription>
        <div className="mt-4 space-y-2">
          <Label htmlFor={`confirm-${tenantId}`}>
            พิมพ์ชื่อบริษัทเพื่อยืนยัน: <span className="font-mono text-slate-900">{expected}</span>
          </Label>
          <Input
            id={`confirm-${tenantId}`}
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            placeholder={expected}
            autoComplete="off"
          />
          {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="ghost" type="button">Cancel</Button>
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={!canDelete}
          >
            {loading ? "Deleting..." : "Delete tenant"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
