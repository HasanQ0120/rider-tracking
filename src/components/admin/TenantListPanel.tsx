"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MerchantButton, MerchantInput, MerchantPageHeader } from "@/components/merchant/MerchantUi";
import { tenantStatusLabel, type TenantRow } from "@/lib/admin/tenantTypes";

type TenantListItem = Pick<
  TenantRow,
  "id" | "merchant_id" | "name" | "active" | "suspended_at" | "contact_email" | "api_key_prefix" | "created_at"
>;

function StatusBadge({ tenant }: { tenant: Pick<TenantListItem, "active" | "suspended_at"> }) {
  const label = tenantStatusLabel(tenant);
  const classes =
    label === "Active"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
      : label === "Suspended"
        ? "bg-red-50 text-red-700 ring-red-600/20"
        : "bg-slate-100 text-slate-600 ring-slate-500/20";

  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${classes}`}>
      {label}
    </span>
  );
}

export function TenantListPanel({ tenants }: { tenants: TenantListItem[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter(
      (t) =>
        t.merchant_id.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        (t.contact_email?.toLowerCase().includes(q) ?? false)
    );
  }, [tenants, query]);

  return (
    <div>
      <MerchantPageHeader
        title="Tenants"
        subtitle="Provision and manage merchant accounts across the platform."
        actions={
          <Link href="/admin/tenants/new">
            <MerchantButton>Add tenant</MerchantButton>
          </Link>
        }
      />

      <div className="mb-4">
        <MerchantInput
          type="search"
          placeholder="Search by merchant ID, name, or email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Merchant</th>
              <th className="hidden px-4 py-3 md:table-cell">Contact</th>
              <th className="px-4 py-3">Status</th>
              <th className="hidden px-4 py-3 sm:table-cell">API key</th>
              <th className="hidden px-4 py-3 lg:table-cell">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                  {tenants.length === 0 ? "No tenants yet." : "No tenants match your search."}
                </td>
              </tr>
            ) : (
              filtered.map((tenant) => (
                <tr key={tenant.id} className="transition-colors hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/tenants/${tenant.id}`} className="group block">
                      <span className="font-semibold text-slate-900 group-hover:text-[#1e3a5f]">
                        {tenant.name}
                      </span>
                      <span className="mt-0.5 block font-mono text-xs text-slate-500">{tenant.merchant_id}</span>
                    </Link>
                  </td>
                  <td className="hidden px-4 py-3 text-slate-600 md:table-cell">
                    {tenant.contact_email ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge tenant={tenant} />
                  </td>
                  <td className="hidden px-4 py-3 font-mono text-xs text-slate-500 sm:table-cell">
                    {tenant.api_key_prefix ? `${tenant.api_key_prefix}…` : "None"}
                  </td>
                  <td className="hidden px-4 py-3 text-slate-500 lg:table-cell">
                    {new Date(tenant.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
