import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { getTenantForAdmin } from "@/lib/auth/admin";

export default async function RagPlaygroundPage() {
  const tenantId = await getTenantForAdmin();
  return (
    <>
      <PageHeader title="Test AI Answers" description="ทดสอบคำถามก่อนเชื่อมต่อ bot จริง โดย log เป็น playground usage" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Test Question</CardTitle>
            <CardDescription>Playground calls /api/admin/playground and does not consume production quota.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4">
              <input type="hidden" name="tenant_id" value={tenantId ?? ""} />
              <Textarea placeholder="ลาป่วยได้กี่วัน" />
              <Button type="button">Run RAG Test</Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Result</CardTitle>
            <CardDescription>Answer, sources, model, token usage, cost, and classification appear here.</CardDescription>
          </CardHeader>
          <CardContent className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
            No test result yet. Use the API route directly or wire this form to client-side fetch for interactive testing.
          </CardContent>
        </Card>
      </div>
    </>
  );
}
