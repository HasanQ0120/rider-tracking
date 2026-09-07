import { notFound } from "next/navigation";
import { RidersPanel } from "@/components/ops/RidersPanel";
import { createServiceClient } from "@/lib/supabase/service";

type PageProps = { params: Promise<{ id: string }> };

export default async function TenantRidersPage({ params }: PageProps) {
  const { id } = await params;
  const service = createServiceClient();

  const { data: tenant } = await service.from("tenants").select("id").eq("id", id).maybeSingle();
  if (!tenant) notFound();

  const { data: riders } = await service
    .from("riders")
    .select("id, name, phone, license_plate, active, available, availability_token, created_at")
    .eq("tenant_id", id)
    .order("created_at", { ascending: false });

  const { data: orders } = await service
    .from("orders")
    .select("assigned_rider_id, status")
    .eq("tenant_id", id);

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

  const base = `/api/admin/tenants/${id}/riders`;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <RidersPanel
        initialRiders={ridersWithCounts}
        createEndpoint={base}
        bulkImportEndpoint={`${base}/bulk`}
        locationEndpointBase={base}
        variant="light"
      />
    </div>
  );
}
