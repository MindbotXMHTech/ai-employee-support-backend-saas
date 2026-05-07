import { EmptyState } from "@/components/admin/empty-state";
import { DeleteDocumentButton } from "@/components/admin/delete-document-button";
import { DocumentUploadForm } from "@/components/admin/document-upload-form";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getTenantForAdmin } from "@/lib/auth/admin";
import { tenantTables } from "@/lib/services/adminDataService";
import { formatBytes } from "@/lib/utils";

export default async function KnowledgeBasePage() {
  const tenantId = await getTenantForAdmin();
  const data = await tenantTables(tenantId);
  const documents = data?.documents ?? [];
  const storageUsed = documents.reduce((sum, doc) => sum + Number(doc.file_size_bytes ?? 0), 0);

  return (
    <>
      <PageHeader title="Knowledge Base" description="อัปโหลด PDF, DOCX, TXT หรือ Markdown เพื่อสร้าง RAG เฉพาะบริษัท" />
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Upload Document</CardTitle>
        </CardHeader>
        <CardContent>
          {tenantId ? <DocumentUploadForm tenantId={tenantId} /> : null}
          <p className="mt-3 text-sm text-slate-500">Storage used: {formatBytes(storageUsed)}</p>
        </CardContent>
      </Card>
      {documents.length ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">{doc.file_name}</TableCell>
                    <TableCell>{doc.document_category}</TableCell>
                    <TableCell>{formatBytes(Number(doc.file_size_bytes ?? 0))}</TableCell>
                    <TableCell><Badge variant={doc.status === "ready" ? "success" : doc.status === "failed" ? "destructive" : "warning"}>{doc.status}</Badge></TableCell>
                    <TableCell className="max-w-xs truncate text-slate-500">{doc.processing_error}</TableCell>
                    <TableCell>
                      <DeleteDocumentButton documentId={doc.id} fileName={doc.file_name} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <EmptyState title="No documents yet" description="Upload company HR, benefit, welfare, leave, or FAQ documents to activate RAG." />
      )}
    </>
  );
}
