import Link from "next/link";
import { requireMerchantUser } from "@/lib/merchant/authGuard";
import { serverApi } from "@/lib/api/server";
import {
  MerchantButton,
  MerchantContentCard,
  MerchantPageHeader,
  MerchantStatCard,
} from "@/components/merchant/MerchantUi";
import { buildOrderCodeMap } from "@/lib/orderCode";
import { orderStatusBadgeClasses, orderStatusLabel } from "@/lib/orderStatus";

type DashOrder = {
  id: string;
  customer_name: string;
  status: string;
  created_at: string;
  riders: { name: string } | { name: string }[] | null;
};

type DashRider = {
  id: string;
  available: boolean;
  active: boolean;
};

export default async function MerchantDashboardPage() {
  const merchant = await requireMerchantUser();
  const api = await serverApi("/merchant/login");

  const [{ data: ordersRes }, { data: ridersRes }] = await Promise.all([
    api.get<{ status: string; orders: DashOrder[] }>("/api/merchant/orders"),
    api.get<{ status: string; riders: DashRider[] }>("/api/merchant/riders"),
  ]);

  const orders = ordersRes.orders ?? [];
  const riders = ridersRes.riders ?? [];
  const codeMap = buildOrderCodeMap(orders);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const todayOrders = orders.filter((o) => new Date(o.created_at) >= startOfDay).length;
  const activeOrders = orders.filter((o) =>
    ["assigned", "in_transit", "arrived", "pending_confirmation"].includes(o.status)
  ).length;
  const flaggedOrders = orders.filter((o) => o.status === "flagged_review").length;
  const activeRiders = riders.filter((r) => r.active).length;
  const acceptingRiders = riders.filter((r) => r.active && r.available).length;

  function riderName(ridersField: DashOrder["riders"]): string | null {
    if (!ridersField) return null;
    return Array.isArray(ridersField) ? ridersField[0]?.name ?? null : ridersField.name;
  }

  return (
    <div className="animate-slide-up">
      <MerchantPageHeader
        title="Dashboard"
        subtitle={`Welcome back, ${merchant.name}.`}
        actions={
          <Link href="/merchant/orders">
            <MerchantButton variant="secondary">View all orders</MerchantButton>
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MerchantStatCard
          label="Active orders"
          value={activeOrders}
          hint="In progress right now"
        />
        <MerchantStatCard label="Today" value={todayOrders} hint="Orders created today" />
        <MerchantStatCard
          label="Riders"
          value={activeRiders}
          hint={`${acceptingRiders} accepting orders`}
        />
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
          subtitle="Latest deliveries for your merchant"
          action={
            <Link
              href="/merchant/orders"
              className="text-sm font-medium text-[var(--merchant-primary)] hover:underline"
            >
              All orders →
            </Link>
          }
        >
          {orders.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No orders yet.</p>
          ) : (
            <div className="-mx-6 -my-6 divide-y divide-slate-100">
              {orders.slice(0, 8).map((o) => {
                const rider = riderName(o.riders);
                return (
                  <Link
                    key={o.id}
                    href={`/merchant/orders/${o.id}`}
                    className="flex items-center justify-between gap-4 px-6 py-3 transition-colors hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-[var(--merchant-primary)]">
                        {codeMap.get(o.id)}
                      </p>
                      <p className="truncate font-medium text-slate-900">{o.customer_name}</p>
                      <p className="truncate text-xs text-slate-500">
                        {rider ? `Rider · ${rider}` : "Unassigned"}
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

        <MerchantContentCard title="Quick links" subtitle="Common actions">
          <div className="space-y-2">
            <Link
              href="/merchant/orders"
              className="block rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              Orders
            </Link>
            <Link
              href="/merchant/riders"
              className="block rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              Riders
            </Link>
            <Link
              href="/merchant/settings"
              className="block rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              Settings & API
            </Link>
          </div>
        </MerchantContentCard>
      </div>
    </div>
  );
}
