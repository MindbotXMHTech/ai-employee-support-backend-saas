import Link from "next/link";
import { cn } from "@/lib/utils";

const sections = [
  { href: "", label: "Overview" },
  { href: "/profile", label: "Profile" },
  { href: "/ai-settings", label: "AI Settings" },
  { href: "/knowledge-base", label: "Knowledge Base" },
  { href: "/employees", label: "Employee Links" },
  { href: "/workflow-tokens", label: "Workflow HTTP" },
  { href: "/usage", label: "Usage" },
  { href: "/conversations", label: "Conversations" },
  { href: "/safety", label: "Safety" },
];

export function PlatformTenantNav({ tenantId, active }: { tenantId: string; active: string }) {
  return (
    <nav className="mb-6 flex gap-2 overflow-x-auto border-b border-slate-200 pb-3">
      {sections.map((section) => {
        const key = section.href || "overview";
        return (
          <Link
            key={key}
            href={`/platform/tenants/${tenantId}${section.href}`}
            className={cn(
              "whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950",
              active === key && "bg-slate-950 text-white hover:bg-slate-950 hover:text-white",
            )}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
