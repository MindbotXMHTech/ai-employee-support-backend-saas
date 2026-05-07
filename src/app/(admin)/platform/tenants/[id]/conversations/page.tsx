import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { PlatformTenantNav } from "@/components/admin/platform-tenant-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { tenantManagementData } from "@/lib/services/adminDataService";

export default async function PlatformTenantConversationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await tenantManagementData(id);

  return (
    <>
      <Button asChild variant="ghost" className="mb-4">
        <Link href={`/platform/tenants/${id}`}><ArrowLeft className="h-4 w-4" /> Back to tenant</Link>
      </Button>
      <PageHeader title="Tenant Conversations" description="Conversation logs for platform support. Content may contain sensitive data." />
      <PlatformTenantNav tenantId={id} active="/conversations" />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Conversation</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Last Message Type</TableHead>
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
