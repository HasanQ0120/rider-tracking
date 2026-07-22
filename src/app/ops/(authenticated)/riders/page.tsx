import { requireOpsUser } from "@/lib/ops/authGuard";
import { createServiceClient } from "@/lib/supabase/service";
import { RidersPanel } from "@/components/ops/RidersPanel";

export default async function RidersPage() {
  await requireOpsUser();
  const supabase = createServiceClient();
  const { data: riders } = await supabase
    .from("riders")
    .select("id, name, phone, license_plate, active, created_at")
    .order("created_at", { ascending: false });

  // Additive read, display-only: the riders table has no delivery/active
  // counts of its own, so derive them here from the existing orders table
  // (same shape of query already used on the Dashboard/Orders pages) rather
  // than adding a column or a new route.
  const { data: orders } = await supabase.from("orders").select("assigned_rider_id, status");

  const counts = new Map<string, { delivered: number; active: number }>();
  for (const o of orders ?? []) {
    if (!o.assigned_rider_id) continue;
    const entry = counts.get(o.assigned_rider_id) ?? { delivered: 0, active: 0 };
    if (o.status === "delivered") entry.delivered += 1;
    if (["assigned", "in_transit", "arrived"].includes(o.status)) entry.active += 1;
    counts.set(o.assigned_rider_id, entry);
  }

  const ridersWithCounts = (riders ?? []).map((r) => ({
    ...r,
    deliveredCount: counts.get(r.id)?.delivered ?? 0,
    activeCount: counts.get(r.id)?.active ?? 0,
  }));

  return (
    <div className="mx-auto max-w-2xl animate-slide-up">
      <h1 className="mb-6 text-2xl font-semibold text-white">Riders</h1>
      <RidersPanel initialRiders={ridersWithCounts} />
    </div>
  );
}
