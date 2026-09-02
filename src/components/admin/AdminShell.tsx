import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { AdminLogoutButton } from "@/components/admin/AdminLogoutButton";

export function AdminShell({
  email,
  children,
}: {
  email: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#eef1f6] text-slate-900">
      <header className="border-b border-slate-200 bg-white px-6 py-3 shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <Link href="/admin" className="flex items-center gap-2.5">
            <Logo size={32} />
            <span className="flex items-baseline gap-1.5">
              <span className="font-semibold tracking-wide text-slate-900">Rider Tracking</span>
              <span className="text-xs text-slate-500">Platform Admin</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            {email ? <span className="hidden text-sm text-slate-500 sm:inline">{email}</span> : null}
            <AdminLogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-6">{children}</main>
    </div>
  );
}
