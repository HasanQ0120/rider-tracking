"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TenantLogo } from "@/components/merchant/TenantLogo";
import { MerchantSidebar } from "@/components/merchant/MerchantSidebar";
import { MerchantUserMenu } from "@/components/merchant/MerchantUserMenu";
import { MerchantSearchProvider, useMerchantSearch } from "@/components/merchant/MerchantSearchContext";
import { MERCHANT_NAV_SECTIONS, merchantRouteMeta } from "@/lib/merchant/nav";
import type { TenantBranding } from "@/lib/merchant/branding";

function HeaderSearch() {
  const { query, setQuery } = useMerchantSearch();
  return (
    <div className="relative hidden flex-1 md:block md:max-w-md lg:max-w-lg">
      <svg
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3-3" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search riders, orders, plates…"
        className="w-full rounded-full border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[var(--merchant-primary)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--merchant-primary)]/20"
      />
    </div>
  );
}

function ShellInner({
  merchantName,
  merchantId,
  branding,
  children,
}: {
  merchantName: string;
  merchantId: string;
  branding: TenantBranding;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const meta = merchantRouteMeta(pathname);

  return (
    <div
      className="merchant-portal flex min-h-screen bg-[#eef1f6] text-slate-900"
      style={
        {
          "--merchant-primary": branding.primaryColor,
          "--merchant-secondary": branding.secondaryColor,
          "--merchant-accent": branding.secondaryColor,
        } as React.CSSProperties
      }
    >
      <aside className="flex min-h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white lg:w-64">
        <Link
          href="/merchant"
          className="flex items-center gap-3 border-b border-slate-100 px-5 py-5"
        >
          <TenantLogo
            name={merchantName}
            logoUrl={branding.logoUrl}
            size={40}
            accentColor={branding.secondaryColor}
          />
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold text-slate-900">{merchantName}</span>
            <span className="block truncate text-xs text-slate-500">{merchantId}</span>
          </span>
        </Link>
        <MerchantSidebar
          sections={MERCHANT_NAV_SECTIONS}
          activePath={pathname}
          primaryColor={branding.primaryColor}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-slate-200 bg-white px-4 py-3 md:px-6">
          <div className="flex items-center gap-4">
            <nav className="hidden shrink-0 items-center gap-1.5 text-xs text-slate-500 sm:flex">
              {meta.breadcrumbs.map((crumb, i) => (
                <span key={crumb} className="flex items-center gap-1.5">
                  {i > 0 ? <span className="text-slate-300">/</span> : null}
                  <span className={i === meta.breadcrumbs.length - 1 ? "text-slate-700" : ""}>
                    {crumb}
                  </span>
                </span>
              ))}
            </nav>
            <HeaderSearch />
            <MerchantUserMenu
              name={merchantName}
              merchantId={merchantId}
              primaryColor={branding.primaryColor}
            />
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

export function MerchantDashboardShell({
  merchantName,
  merchantId,
  branding,
  children,
}: {
  merchantName: string;
  merchantId: string;
  branding: TenantBranding;
  children: React.ReactNode;
}) {
  return (
    <MerchantSearchProvider>
      <ShellInner
        merchantName={merchantName}
        merchantId={merchantId}
        branding={branding}
      >
        {children}
      </ShellInner>
    </MerchantSearchProvider>
  );
}
