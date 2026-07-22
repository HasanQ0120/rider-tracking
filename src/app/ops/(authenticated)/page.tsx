import Link from "next/link";
import { requireOpsUser } from "@/lib/ops/authGuard";
import { createServiceClient } from "@/lib/supabase/service";
import { Button } from "@/components/ui/Button";
import { buildOrderCodeMap } from "@/lib/orderCode";
import { orderStatusBadgeClasses, orderStatusLabel } from "@/lib/orderStatus";

function StatCard({
  icon,
  iconClass,
  value,
  label,
}: {
  icon: React.ReactNode;
  iconClass: string;
  value: number;
  label: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-surface-raised p-5">
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${iconClass}`}>{icon}</div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-sm text-white/50">{label}</p>
    </div>
  );
}

export default async function DashboardPage() {
  await requireOpsUser();
  const supabase = createServiceClient();

  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, customer_name, delivery_address, status, created_at, riders:assigned_rider_id(name)"
    )
    .order("created_at", { ascending: false });

  const { count: riderCount } = await supabase
    .from("riders")
    .select("id", { count: "exact", head: true });

  const allOrders = orders ?? [];
  const codeMap = buildOrderCodeMap(allOrders);
  const activeOrders = allOrders.filter((o) => ["assigned", "in_transit", "arrived"].includes(o.status));
  const inTransitCount = allOrders.filter((o) => o.status === "in_transit").length;
  const deliveredCount = allOrders.filter((o) => o.status === "delivered").length;
  const flaggedCount = allOrders.filter((o) => o.status === "flagged_review").length;

  return (
    <div className="animate-slide-up">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
          <p className="text-sm text-white/50">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <Link href="/ops/orders/new">
          <Button>+ New Order</Button>
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          icon={<ClockIcon />}
          iconClass="bg-amber-500/15 text-amber-400"
          value={activeOrders.length}
          label="Active Orders"
        />
        <StatCard
          icon={<TruckIcon />}
          iconClass="bg-blue-500/15 text-blue-400"
          value={inTransitCount}
          label="In Transit"
        />
        <StatCard
          icon={<CheckIcon />}
          iconClass="bg-status-success/15 text-status-success"
          value={deliveredCount}
          label="Delivered"
        />
        <StatCard
          icon={<WarningIcon />}
          iconClass="bg-status-danger/15 text-status-danger"
          value={flaggedCount}
          label="Flagged"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-surface-raised p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold text-white">
              <span className="h-2 w-2 rounded-full bg-brand-gold" />
              Active Orders
            </h2>
            <Link href="/ops/orders" className="text-sm text-brand-gold hover:underline">
              View all →
            </Link>
          </div>
          {activeOrders.length === 0 ? (
            <p className="py-8 text-center text-sm text-white/40">No active orders right now.</p>
          ) : (
            <div className="divide-y divide-white/10">
              {activeOrders.slice(0, 5).map((o) => {
                const r = Array.isArray(o.riders) ? o.riders[0] : o.riders;
                return (
                  <Link
                    key={o.id}
                    href={`/ops/orders/${o.id}`}
                    className="flex items-center justify-between gap-4 py-3 transition-colors hover:bg-white/5"
                  >
                    <div>
                      <p className="font-mono text-xs text-brand-gold">{codeMap.get(o.id)}</p>
                      <p className="font-medium text-white">{o.customer_name}</p>
                      <p className="text-xs text-white/50">{o.delivery_address}</p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${orderStatusBadgeClasses(o.status)}`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {orderStatusLabel(o.status)}
                      </span>
                      <p className="mt-1 text-xs text-white/40">{r?.name ?? "Unassigned"}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-surface-raised p-5">
            <h2 className="mb-3 font-semibold text-white">Quick Actions</h2>
            <div className="space-y-2">
              <Link
                href="/ops/orders/new"
                className="flex items-center justify-between rounded-lg border border-brand-gold/30 bg-brand-gold/10 p-3 transition-colors hover:bg-brand-gold/15"
              >
                <div>
                  <p className="font-medium text-white">Create Order</p>
                  <p className="text-xs text-white/50">Add delivery + pin map</p>
                </div>
                <span className="text-white/40">→</span>
              </Link>
              <Link
                href="/ops/orders"
                className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3 transition-colors hover:bg-white/10"
              >
                <div>
                  <p className="font-medium text-white">All Orders</p>
                  <p className="text-xs text-white/50">{allOrders.length} total</p>
                </div>
                <span className="text-white/40">→</span>
              </Link>
              <Link
                href="/ops/riders"
                className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3 transition-colors hover:bg-white/10"
              >
                <div>
                  <p className="font-medium text-white">Manage Riders</p>
                  <p className="text-xs text-white/50">{riderCount ?? 0} registered</p>
                </div>
                <span className="text-white/40">→</span>
              </Link>
            </div>
          </div>

          {flaggedCount > 0 && (
            <Link
              href="/ops/orders"
              className="block rounded-xl border border-status-danger/30 bg-status-danger/10 p-4 transition-colors hover:bg-status-danger/15"
            >
              <p className="flex items-center gap-2 font-medium text-status-danger">
                <WarningIcon />
                {flaggedCount} flagged order{flaggedCount > 1 ? "s" : ""} need review
              </p>
              <p className="mt-1 text-xs text-status-danger/80">Tap to review flagged deliveries</p>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}
function TruckIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M3 16V6a1 1 0 011-1h9v11" />
      <path d="M13 9h4l3 3v4h-2" />
      <circle cx="7" cy="17" r="1.5" />
      <circle cx="16.5" cy="17" r="1.5" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </svg>
  );
}
function WarningIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M12 3l9 16H3l9-16z" />
      <path d="M12 10v3" />
      <circle cx="12" cy="16.5" r="0.5" fill="currentColor" />
    </svg>
  );
}
