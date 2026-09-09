import { notFound } from "next/navigation";
import { RidersPanel } from "@/components/ops/RidersPanel";
import { serverApi } from "@/lib/api/server";
import axios from "axios";

type PageProps = { params: Promise<{ id: string }> };

type RiderRow = {
  id: string;
  name: string;
  phone: string;
  license_plate: string | null;
  active: boolean;
  available: boolean;
  availability_token?: string | null;
  branch_id?: string | null;
  created_at: string;
};

type BranchRow = { id: string; name: string; code: string; active: boolean };
type OrderCountRow = { assigned_rider_id: string | null; status: string };

export default async function TenantRidersPage({ params }: PageProps) {
  const { id } = await params;
  const api = await serverApi("/admin/login");

  try {
    const [{ data: ridersRes }, { data: ordersRes }, { data: branchesRes }] = await Promise.all([
      api.get<{ riders: RiderRow[] }>(`/api/admin/tenants/${id}/riders`),
      api.get<{ status: string; orders: OrderCountRow[] }>(`/api/admin/tenants/${id}/orders`),
      api.get<{ status: string; branches: BranchRow[] }>(`/api/admin/tenants/${id}/branches`),
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

    const base = `/api/admin/tenants/${id}/riders`;

    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <RidersPanel
          initialRiders={ridersWithCounts}
          branches={branchesRes.branches ?? []}
          createEndpoint={base}
          bulkImportEndpoint={`${base}/bulk`}
          locationEndpointBase={base}
          variant="light"
        />
      </div>
    );
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) notFound();
    throw err;
  }
}
