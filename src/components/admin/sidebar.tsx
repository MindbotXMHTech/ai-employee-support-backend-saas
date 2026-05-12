"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Cable,
  FileText,
  Gauge,
  KeyRound,
  MessageSquare,
  Settings,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { LogoutButton } from "@/components/admin/logout-button";
import { cn } from "@/lib/utils";

const companyLinks = [
  { href: "/dashboard", label: "My Company Overview", icon: Gauge },
  { href: "/dashboard/knowledge-base", label: "Knowledge Base", icon: FileText },
  { href: "/dashboard/api-keys", label: "Bot Access Code", icon: KeyRound },
  { href: "/dashboard/workflow-tokens", label: "Workflow HTTP", icon: Cable },
  { href: "/dashboard/playground", label: "Test AI Answers", icon: MessageSquare },
  { href: "/dashboard/usage", label: "Usage", icon: Activity },
  { href: "/dashboard/conversations", label: "Employee Conversations", icon: MessageSquare },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

const platformLinks = [
  { href: "/platform", label: "Platform Overview", icon: Gauge },
  { href: "/platform/tenants", label: "Tenants", icon: Users },
  { href: "/platform/usage", label: "Platform Usage", icon: Activity },
  { href: "/platform/model-pricing", label: "Model Pricing", icon: SlidersHorizontal },
  { href: "/platform/audit-logs", label: "Audit Logs", icon: FileText },
];

export function AdminSidebar() {
  return (
    <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white lg:block">
      <AdminNavigation />
    </aside>
  );
}

export function MobileAdminNav() {
  return (
    <Dialog>
      <DialogTrigger className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
        Menu
      </DialogTrigger>
      <DialogContent className="left-0 top-0 h-dvh w-80 max-w-[85vw] translate-x-0 translate-y-0 rounded-none border-l-0 border-y-0 p-0">
        <DialogTitle className="sr-only">Admin navigation</DialogTitle>
        <DialogDescription className="sr-only">Choose an admin section to navigate to.</DialogDescription>
        <AdminNavigation closeOnNavigate />
      </DialogContent>
    </Dialog>
  );
}

function AdminNavigation({ closeOnNavigate = false }: { closeOnNavigate?: boolean }) {
  const pathname = usePathname();
  const isPlatform = pathname.startsWith("/platform");
  const links = isPlatform ? platformLinks : companyLinks;
  const title = isPlatform ? "Platform Admin" : "Company Admin";
  const homeHref = isPlatform ? "/platform" : "/dashboard";

  return (
    <>
      <div className="flex h-16 items-center border-b border-slate-200 px-6">
        <Link href={homeHref} className="font-semibold tracking-tight text-slate-950">
          AI Support SaaS
        </Link>
      </div>
      <nav className="space-y-1 p-4">
        <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
        {links.map((link) => {
          const Icon = link.icon;
          const active = pathname === link.href || (link.href !== homeHref && pathname.startsWith(link.href));
          const item = (
            <>
              <Icon className="h-4 w-4" />
              {link.label}
            </>
          );
          return (
            <NavLink key={link.href} href={link.href} closeOnNavigate={closeOnNavigate} active={active}>
              {item}
            </NavLink>
          );
        })}
        <div className="space-y-1">
          <div className="mt-6 border-t border-slate-200 pt-4">
            <NavLink
              href={isPlatform ? "/dashboard" : "/platform"}
              closeOnNavigate={closeOnNavigate}
              active={false}
              compact
            >
              Switch to {isPlatform ? "Company Admin" : "Platform Admin"}
            </NavLink>
          </div>
          <div className="mt-2">
            <LogoutButton compact />
          </div>
        </div>
      </nav>
    </>
  );
}

function NavLink({
  href,
  active,
  closeOnNavigate,
  compact = false,
  children,
}: {
  href: string;
  active: boolean;
  closeOnNavigate: boolean;
  compact?: boolean;
  children: React.ReactNode;
}) {
  const className = compact
    ? "block rounded-lg px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900"
    : cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950",
        active && "bg-slate-100 text-slate-950",
      );

  const link = (
    <Link href={href} className={className}>
      {children}
    </Link>
  );

  return closeOnNavigate ? <DialogClose asChild>{link}</DialogClose> : link;
}
