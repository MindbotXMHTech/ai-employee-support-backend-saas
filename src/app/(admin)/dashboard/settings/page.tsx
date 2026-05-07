import Link from "next/link";
import { Building2, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const settings = [
  {
    href: "/dashboard/settings/company-profile",
    title: "Company Profile",
    description: "Company context, HR contact, support contact, emergency contact, language, and disclaimer.",
    icon: Building2,
  },
  {
    href: "/dashboard/safety",
    title: "Safety & Handoff",
    description: "Escalation contacts, handoff URL, emergency message, and high-risk notification preferences.",
    icon: ShieldAlert,
  },
];

export default function CompanySettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Company-level settings for this workspace." />
      <div className="grid gap-4 md:grid-cols-2">
        {settings.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <Card className="h-full transition-colors hover:bg-slate-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-slate-500" />
                    {item.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-500">{item.description}</CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </>
  );
}
