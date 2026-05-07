import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DeleteDocumentButton } from "@/components/admin/delete-document-button";
import { DocumentUploadForm } from "@/components/admin/document-upload-form";
import { PageHeader } from "@/components/admin/page-header";
import { PlatformTenantNav } from "@/components/admin/platform-tenant-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { tenantManagementData } from "@/lib/services/adminDataService";
import { formatBytes } from "@/lib/utils";

export default async function PlatformTenantKnowledgeBasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await tenantManagementData(id);

  return (
    <>
      <Button asChild variant="ghost" className="mb-4">
        <Link href={`/platform/tenants/${id}`}><ArrowLeft className="h-4 w-4" /> Back to tenant</Link>
      </Button>
      <PageHeader title="Tenant Knowledge Base" description="Documents uploaded by this tenant and their RAG processing state." />
      <PlatformTenantNav tenantId={id} active="/knowledge-base" />
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Upload RAG Document</CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentUploadForm tenantId={id} />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Error</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.documents ?? []).map((document) => (
                <TableRow key={document.id}>
                  <TableCell className="font-medium">{document.file_name}</TableCell>
                  <TableCell>{document.document_category}</TableCell>
                  <TableCell>{formatBytes(Number(document.file_size_bytes ?? 0))}</TableCell>
                  <TableCell><Badge variant={document.status === "ready" ? "success" : document.status === "failed" ? "destructive" : "warning"}>{document.status}</Badge></TableCell>
                  <TableCell className="max-w-xs truncate text-slate-500">{document.processing_error}</TableCell>
                  <TableCell>
                    <DeleteDocumentButton documentId={document.id} fileName={document.file_name} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
