import { PageHeader } from "@/components/admin/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createSupabaseServiceClient, hasSupabaseConfig } from "@/lib/supabase/server";

async function getAuditLogs() {
  if (!hasSupabaseConfig()) return [];
  const supabase = createSupabaseServiceClient();
  const { data } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(50);
  return data ?? [];
}

export default async function AuditLogsPage() {
  const logs = await getAuditLogs();
  return (
    <>
      <PageHeader title="Audit Logs" description="Administrative actions for security review and compliance." />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{log.action}</TableCell>
                  <TableCell>{log.target_type ?? "-"} / {log.target_id ?? "-"}</TableCell>
                  <TableCell>{log.tenant_id ?? "platform"}</TableCell>
                  <TableCell>{log.created_at}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
