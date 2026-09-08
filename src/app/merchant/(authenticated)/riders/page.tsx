import { requireMerchantUser } from "@/lib/merchant/authGuard";
import { serverApi } from "@/lib/api/server";
import { MerchantPageHeader } from "@/components/merchant/MerchantUi";
import { RidersPanel } from "@/components/ops/RidersPanel";

type RiderRow = {
  id: string;
  name: string;
  phone: string;
  license_plate: string | null;
  active: boolean;
  available: boolean;
  availability_token?: string | null;
  created_at: string;
};

type OrderCountRow = { assigned_rider_id: string | null; status: string };

export default async function MerchantRidersPage() {
  await requireMerchantUser();
  const api = await serverApi("/merchant/login");

  const [{ data: ridersRes }, { data: ordersRes }] = await Promise.all([
    api.get<{ status: string; riders: RiderRow[] }>("/api/merchant/riders"),
    api.get<{ status: string; orders: OrderCountRow[] }>("/api/merchant/orders"),
  ]);

  const counts = new Map<string, { delivered: number; active: number }>();
  for (const o of ordersRes.orders ?? []) {
    if (!o.assigned_rider_id) continue;
    const entry = counts.get(o.assigned_rider_id) ?? { delivered: 0, active: 0 };
    if (o.status === "delivered") entry.delivered += 1;
    if (["assigned", "in_transit", "arrived"].includes(o.status)) entry.active += 1;
    counts.set(o.assigned_rider_id, entry);
  }

  const ridersWithCounts = (ridersRes.riders ?? []).map((r) => ({
    ...r,
    deliveredCount: counts.get(r.id)?.delivered ?? 0,
    activeCount: counts.get(r.id)?.active ?? 0,
  }));

  const onDelivery = ridersWithCounts.filter((r) => (r.activeCount ?? 0) > 0).length;
  const accepting = ridersWithCounts.filter((r) => r.available).length;

  return (
    <>
      <MerchantPageHeader
        title="Riders"
        subtitle={
          <>
            {ridersWithCounts.length} registered · {accepting} accepting orders · {onDelivery} on
            delivery right now
          </>
        }
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <RidersPanel
          initialRiders={ridersWithCounts}
          createEndpoint="/api/merchant/riders"
          bulkImportEndpoint="/api/merchant/riders/bulk"
          locationEndpointBase="/api/merchant/riders"
          variant="light"
        />
      </div>
    </>
  );
}
