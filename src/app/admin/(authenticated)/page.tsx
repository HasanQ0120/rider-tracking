import Link from "next/link";
import { serverApi } from "@/lib/api/server";
import type { TenantRow } from "@/lib/admin/tenantTypes";
import {
  MerchantButton,
  MerchantContentCard,
  MerchantPageHeader,
  MerchantStatCard,
} from "@/components/merchant/MerchantUi";
import { buildOrderCodeMap } from "@/lib/orderCode";
import { orderStatusBadgeClasses, orderStatusLabel } from "@/lib/orderStatus";
import { tenantStatusLabel } from "@/lib/admin/tenantTypes";

type DashboardOrder = {
  id: string;
  customer_name: string;
  delivery_address: string;
  status: string;
  created_at: string;
  tenant_id: string | null;
  tenants: { name: string; merchant_id: string | null } | null;
  riders: { name: string } | null;
};

export default async function AdminDashboardPage() {
  const api = await serverApi("/admin/login");

  const [{ data: tenantsRes }, { data: ordersRes }] = await Promise.all([
    api.get<{ status: string; tenants: TenantRow[] }>("/api/admin/tenants"),
    api.get<{ status: string; orders: DashboardOrder[]; rider_count: number }>(
      "/api/admin/orders?limit=50"
    ),
  ]);

  const tenantList = tenantsRes.tenants ?? [];
  const orderList = ordersRes.orders ?? [];
  const riderCount = ordersRes.rider_count ?? 0;
  const codeMap = buildOrderCodeMap(orderList);

  const activeTenants = tenantList.filter((t) => !t.suspended_at && t.active).length;
  const suspendedTenants = tenantList.filter((t) => t.suspended_at).length;
  const activeOrders = orderList.filter((o) =>
    ["assigned", "in_transit", "arrived", "pending_confirmation"].includes(o.status)
  ).length;
  const flaggedOrders = orderList.filter((o) => o.status === "flagged_review").length;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todayOrders = orderList.filter((o) => new Date(o.created_at) >= startOfDay).length;

  return (
    <div className="animate-slide-up">
      <MerchantPageHeader
        title="Dashboard"
        subtitle="Platform-wide view across all merchants."
        actions={
          <Link href="/admin/tenants/new">
            <MerchantButton>Add tenant</MerchantButton>
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MerchantStatCard
          label="Tenants"
          value={tenantList.length}
          hint={`${activeTenants} active · ${suspendedTenants} suspended`}
        />
        <MerchantStatCard label="Active orders" value={activeOrders} hint="In progress across tenants" />
        <MerchantStatCard label="Today" value={todayOrders} hint="Orders created today" />
        <MerchantStatCard
          label="Flagged"
          value={flaggedOrders}
          hint="Needs review"
          alert={flaggedOrders > 0}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <MerchantContentCard
          className="lg:col-span-2"
          title="Recent orders"
          subtitle={`${riderCount} riders registered platform-wide`}
          action={
            <Link
              href="/admin/tenants"
              className="text-sm font-medium text-[var(--merchant-primary)] hover:underline"
            >
              Browse tenants →
            </Link>
          }
        >
          {orderList.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No orders yet.</p>
          ) : (
            <div className="-mx-6 -my-6 divide-y divide-slate-100">
              {orderList.slice(0, 8).map((o) => {
                const tenant = Array.isArray(o.tenants) ? o.tenants[0] : o.tenants;
                const rider = Array.isArray(o.riders) ? o.riders[0] : o.riders;
                return (
                  <Link
                    key={o.id}
                    href={
                      o.tenant_id
                        ? `/admin/tenants/${o.tenant_id}/orders/${o.id}`
                        : "/admin/tenants"
                    }
                    className="flex items-center justify-between gap-4 px-6 py-3 transition-colors hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-[var(--merchant-primary)]">
                        {codeMap.get(o.id)}
                      </p>
                      <p className="truncate font-medium text-slate-900">{o.customer_name}</p>
                      <p className="truncate text-xs text-slate-500">
                        {tenant?.name ?? "Unknown tenant"}
                        {rider?.name ? ` · ${rider.name}` : ""}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${orderStatusBadgeClasses(o.status, true)}`}
                    >
                      {orderStatusLabel(o.status)}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </MerchantContentCard>

        <MerchantContentCard title="Tenants" subtitle="Latest accounts">
          {tenantList.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No tenants yet.</p>
          ) : (
            <div className="-mx-6 -my-6 divide-y divide-slate-100">
              {tenantList.slice(0, 6).map((t) => (
                <Link
                  key={t.id}
                  href={`/admin/tenants/${t.id}`}
                  className="flex items-center justify-between gap-3 px-6 py-3 transition-colors hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{t.name}</p>
                    <p className="font-mono text-xs text-slate-500">{t.merchant_id}</p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-500">{tenantStatusLabel(t)}</span>
                </Link>
              ))}
            </div>
          )}
        </MerchantContentCard>
      </div>
    </div>
  );
}
