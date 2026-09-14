"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui/Logo";
import { PortalSidebar } from "@/components/portal/PortalSidebar";
import { PortalUserMenu } from "@/components/portal/PortalUserMenu";
import { ADMIN_NAV_SECTIONS, adminRouteMeta } from "@/lib/admin/nav";
import { PORTAL_THEME } from "@/lib/portalTheme";

export function AdminShell({
  email,
  children,
}: {
  email: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const meta = adminRouteMeta(pathname);
  const displayName = email?.split("@")[0] ?? "Admin";

  return (
    <div
      className="admin-portal flex min-h-screen bg-[#eef1f6] text-slate-900"
      style={
        {
          "--merchant-primary": PORTAL_THEME.primary,
          "--merchant-secondary": PORTAL_THEME.secondary,
          "--merchant-accent": PORTAL_THEME.accent,
        } as React.CSSProperties
      }
    >
      <aside className="flex min-h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white lg:w-64">
        <Link href="/admin" className="flex items-center gap-3 border-b border-slate-100 px-5 py-5">
          <Logo size={40} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold text-slate-900">Rider Tracking</span>
            <span className="block truncate text-xs text-slate-500">Platform Admin</span>
          </span>
        </Link>
        <PortalSidebar
          sections={ADMIN_NAV_SECTIONS}
          activePath={pathname}
          primaryColor={PORTAL_THEME.primary}
          homeExact="/admin"
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-slate-200 bg-white px-4 py-3 md:px-6">
          <div className="flex items-center gap-4">
            <nav className="hidden shrink-0 items-center gap-1.5 text-xs text-slate-500 sm:flex">
              {meta.breadcrumbs.map((crumb, i) => (
                <span key={`${crumb}-${i}`} className="flex items-center gap-1.5">
                  {i > 0 ? <span className="text-slate-300">/</span> : null}
                  <span className={i === meta.breadcrumbs.length - 1 ? "text-slate-700" : ""}>
                    {crumb}
                  </span>
                </span>
              ))}
            </nav>
            <PortalUserMenu
              name={displayName}
              subtitle={email ?? "Platform admin"}
              primaryColor={PORTAL_THEME.primary}
              logoutHref="/admin/login"
            />
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
