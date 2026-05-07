import { AdminSidebar, MobileAdminNav } from "@/components/admin/sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-slate-50">
      <AdminSidebar />
      <main className="min-w-0 flex-1">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <p className="font-semibold">AI Support SaaS</p>
          <MobileAdminNav />
        </div>
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
