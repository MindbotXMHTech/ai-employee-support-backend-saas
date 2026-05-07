import { PageHeader } from "@/components/admin/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { getTenantForAdmin } from "@/lib/auth/admin";
import { tenantTables } from "@/lib/services/adminDataService";

export default async function CompanyProfileSettingsPage() {
  const data = await tenantTables(await getTenantForAdmin());
  const profile = data?.profile;
  return (
    <>
      <PageHeader title="Company Profile" description="ข้อมูลบริษัท HR และข้อความ disclaimer ที่ AI ใช้ประกอบคำตอบ" />
      <Card>
        <CardContent className="grid gap-4 p-6 md:grid-cols-2">
          {[
            ["Company Name", "company_name"],
            ["Industry", "industry"],
            ["HR Contact Name", "hr_contact_name"],
            ["HR Contact Email", "hr_contact_email"],
            ["HR Contact Phone", "hr_contact_phone"],
            ["Default Language", "default_language"],
          ].map(([label, key]) => (
            <div key={key} className="space-y-2">
              <Label>{label}</Label>
              <Input defaultValue={(profile?.[key] as string) ?? ""} />
            </div>
          ))}
          <div className="space-y-2 md:col-span-2">
            <Label>Company Description</Label>
            <Textarea defaultValue={profile?.company_description ?? ""} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Disclaimer Text</Label>
            <Textarea defaultValue={profile?.disclaimer_text ?? ""} />
          </div>
          <Button className="md:col-span-2">Save Profile</Button>
        </CardContent>
      </Card>
    </>
  );
}
