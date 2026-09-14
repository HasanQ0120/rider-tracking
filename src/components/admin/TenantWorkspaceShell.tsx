"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TenantLogo } from "@/components/merchant/TenantLogo";
import { activeTenantTab, tenantTabs } from "@/lib/admin/nav";
import { tenantStatusLabel } from "@/lib/admin/tenantTypes";

type TenantHeader = {
  id: string;
  name: string;
  merchant_id: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  active: boolean;
  suspended_at: string | null;
};

export function TenantWorkspaceShell({
  tenant,
  children,
}: {
  tenant: TenantHeader;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const tabs = tenantTabs(tenant.id);
  const active = activeTenantTab(pathname, tenant.id);
  const status = tenantStatusLabel(tenant);

  return (
    <div className="animate-slide-up">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <TenantLogo
            name={tenant.name}
            logoUrl={tenant.logo_url}
            size={48}
            accentColor={tenant.secondary_color}
          />
          <div>
            <p className="text-xs font-medium text-slate-500">
              <Link href="/admin/tenants" className="hover:text-slate-800 hover:underline">
                Tenants
              </Link>
              <span className="mx-1.5 text-slate-300">/</span>
              <span className="font-mono">{tenant.merchant_id}</span>
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{tenant.name}</h1>
            <p className="mt-0.5 text-sm text-slate-500">{status}</p>
          </div>
        </div>
      </div>

      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200">
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={`relative shrink-0 px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "text-[var(--merchant-primary)]"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {tab.label}
              {isActive ? (
                <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[var(--merchant-primary)]" />
              ) : null}
            </Link>
          );
        })}
      </div>

      {children}
    </div>
  );
}
