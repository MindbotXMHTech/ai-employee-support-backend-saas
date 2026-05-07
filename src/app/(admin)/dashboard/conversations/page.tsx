import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getTenantForAdmin } from "@/lib/auth/admin";
import { tenantTables } from "@/lib/services/adminDataService";

export default async function ConversationsPage() {
  const data = await tenantTables(await getTenantForAdmin());
  return (
    <>
      <PageHeader title="Conversation Logs" description="Logs may contain sensitive information. Restrict access and mask mental-health content where needed." />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title / External ID</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Last Message</TableHead>
                <TableHead>Safety</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.conversations ?? []).map((conversation) => {
                const messages = (conversation.messages ?? []) as Array<{ created_at: string; safety_level?: string; message_type?: string }>;
                const last = messages.sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
                return (
                  <TableRow key={conversation.id}>
                    <TableCell>{conversation.title ?? conversation.external_conversation_id ?? conversation.id}</TableCell>
                    <TableCell>{conversation.channel}</TableCell>
                    <TableCell>{last?.message_type ?? "No messages"}</TableCell>
                    <TableCell><Badge variant={last?.safety_level === "crisis" ? "destructive" : "secondary"}>{last?.safety_level ?? "normal"}</Badge></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
