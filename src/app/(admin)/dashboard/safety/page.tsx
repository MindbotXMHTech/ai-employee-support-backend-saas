import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getTenantForAdmin } from "@/lib/auth/admin";
import { tenantTables } from "@/lib/services/adminDataService";

export default async function SafetyPage() {
  const data = await tenantTables(await getTenantForAdmin());
  const settings = data?.escalation;
  return (
    <>
      <PageHeader title="Safety & Handoff" description="ตั้งค่า handoff และข้อความฉุกเฉินสำหรับ high-risk หรือ crisis cases ของบริษัทคุณ" />
      <Card>
        <CardContent className="grid gap-4 p-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label>HR Email</Label>
            <Input defaultValue={settings?.hr_contact_email ?? ""} />
          </div>
          <div className="space-y-2">
            <Label>Counselor Email</Label>
            <Input defaultValue={settings?.counselor_contact_email ?? ""} />
          </div>
          <div className="space-y-2">
            <Label>Handoff URL</Label>
            <Input defaultValue={settings?.handoff_url ?? ""} />
          </div>
          <div className="space-y-2">
            <Label>Button Text</Label>
            <Input defaultValue={settings?.handoff_button_text ?? "ติดต่อ HR"} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Emergency Message</Label>
            <Textarea defaultValue={settings?.emergency_message ?? ""} />
          </div>
          <p className="text-sm text-slate-500 md:col-span-2">
            Notify on high: {settings?.notify_on_high ? "enabled" : "disabled"} · Notify on crisis: {settings?.notify_on_crisis === false ? "disabled" : "enabled"}
          </p>
          <Button className="md:col-span-2">Save Safety Settings</Button>
        </CardContent>
      </Card>
    </>
  );
}
