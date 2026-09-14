"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TenantLogo } from "@/components/merchant/TenantLogo";
import { MerchantSidebar } from "@/components/merchant/MerchantSidebar";
import { MerchantUserMenu } from "@/components/merchant/MerchantUserMenu";
import { MerchantSearchProvider } from "@/components/merchant/MerchantSearchContext";
import { MERCHANT_NAV_SECTIONS, merchantRouteMeta } from "@/lib/merchant/nav";
import type { TenantBranding } from "@/lib/merchant/branding";

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
            <span className="block truncate text-xs text-slate-500">Merchant Portal</span>
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
                <span key={`${crumb}-${i}`} className="flex items-center gap-1.5">
                  {i > 0 ? <span className="text-slate-300">/</span> : null}
                  <span className={i === meta.breadcrumbs.length - 1 ? "text-slate-700" : ""}>
                    {crumb}
                  </span>
                </span>
              ))}
            </nav>
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
