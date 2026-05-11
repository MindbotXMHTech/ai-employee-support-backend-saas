"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Plus, Trash2 } from "lucide-react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export type WorkflowTokenRow = {
  id: string;
  name: string | null;
  token_prefix: string;
  status: string;
  last_used_at: string | null;
  created_at: string;
};

async function readJsonBody<T>(res: Response): Promise<{ parsed: T | null; raw: string }> {
  const raw = await res.text();
  const trimmed = raw.trim();
  if (!trimmed) {
    return { parsed: null, raw: "" };
  }
  try {
    return { parsed: JSON.parse(trimmed) as T, raw };
  } catch {
    return { parsed: null, raw };
  }
}

export function WorkflowTokensManager({
  tenantId,
  initialTokens = [],
}: {
  tenantId: string;
  initialTokens?: WorkflowTokenRow[];
}) {
  const router = useRouter();
  const [tokens, setTokens] = useState<WorkflowTokenRow[]>(initialTokens);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/workflow-tokens?tenant_id=${encodeURIComponent(tenantId)}`, {
        credentials: "include",
      });
      const { parsed: body } = await readJsonBody<{ tokens?: WorkflowTokenRow[]; error?: string }>(res);
      if (!res.ok) {
        setError(body?.error ?? `Failed to load tokens (${res.status}).`);
        return;
      }
      if (!body) {
        setError("Empty response from server.");
        return;
      }
      setTokens(body.tokens ?? []);
    } catch {
      setError("Failed to load tokens.");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  async function handleCreate() {
    setError(null);
    const name = newName.trim() || "Workflow integration";
    let res: Response;
    try {
      res = await fetch("/api/admin/workflow-tokens", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId, name }),
      });
    } catch {
      setError("Network error while creating token.");
      return;
    }
    const { parsed: body, raw } = await readJsonBody<{ rawToken?: string; error?: string }>(res);
    if (!res.ok) {
      setError(body?.error ?? `Create failed (${res.status}).`);
      return;
    }
    if (!body) {
      setError(raw ? `Invalid response (${res.status}).` : `Empty response (${res.status}).`);
      return;
    }
    setNewName("");
    setCreateOpen(false);
    if (body.rawToken) {
      setRevealedToken(body.rawToken);
    }
    await refresh();
    router.refresh();
  }

  async function handleRevoke(id: string) {
    setError(null);
    const res = await fetch(`/api/admin/workflow-tokens/${id}`, { method: "DELETE", credentials: "include" });
    const { parsed: body } = await readJsonBody<{ error?: string }>(res);
    if (!res.ok) {
      setError(body?.error ?? `Revoke failed (${res.status}).`);
      return;
    }
    await refresh();
    router.refresh();
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      setError("Could not copy to clipboard.");
    }
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button type="button" size="sm">
              <Plus className="mr-1 h-4 w-4" />
              New workflow token
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Create workflow token</DialogTitle>
            <DialogDescription>
              The full token is shown only once. Use it as <code className="font-mono">workflow_token</code> in{" "}
              <code className="font-mono">POST /api/v1/chat</code> when your tool cannot set{" "}
              <code className="font-mono">x-central-bot-secret</code>.
            </DialogDescription>
            <div className="space-y-2 py-2">
              <Label htmlFor="wf-token-name">Label (for your reference)</Label>
              <Input
                id="wf-token-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Make.com HR flow"
              />
            </div>
            <div className="flex justify-end gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="button" onClick={() => void handleCreate()}>
                Create
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Button type="button" variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
          Refresh
        </Button>
      </div>

      <Dialog open={!!revealedToken} onOpenChange={(open) => !open && setRevealedToken(null)}>
        <DialogContent>
          <DialogTitle>Copy your workflow token</DialogTitle>
          <DialogDescription>
            Store this somewhere safe. It cannot be retrieved again from the dashboard.
          </DialogDescription>
          {revealedToken ? (
            <div className="flex gap-2">
              <code className="flex-1 break-all rounded-md bg-slate-100 px-3 py-2 text-xs">{revealedToken}</code>
              <Button type="button" variant="outline" size="sm" onClick={() => void copyText(revealedToken)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
          <DialogClose asChild>
            <Button type="button" className="mt-2 w-full">
              Done
            </Button>
          </DialogClose>
        </DialogContent>
      </Dialog>

      <div className="rounded-md border border-slate-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Label</TableHead>
              <TableHead>Prefix</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last used</TableHead>
              <TableHead className="w-[100px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tokens.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-slate-500">
                  {loading ? "Loading…" : "No workflow tokens yet."}
                </TableCell>
              </TableRow>
            ) : (
              tokens.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{row.token_prefix}</TableCell>
                  <TableCell>
                    <Badge variant={row.status === "active" ? "success" : "secondary"}>{row.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">{row.last_used_at ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {row.status === "active" ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => {
                          if (window.confirm("Revoke this token? Integrations using it will stop working.")) {
                            void handleRevoke(row.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
