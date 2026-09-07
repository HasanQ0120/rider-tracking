import { notFound } from "next/navigation";
import { TenantOverviewPanel } from "@/components/admin/TenantOverviewPanel";
import { TENANT_DETAIL_SELECT } from "@/lib/admin/tenantTypes";
import { createServiceClient } from "@/lib/supabase/service";

type PageProps = { params: Promise<{ id: string }> };

export default async function TenantOverviewPage({ params }: PageProps) {
  const { id } = await params;
  const service = createServiceClient();
  const { data: tenant } = await service
    .from("tenants")
    .select(TENANT_DETAIL_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (!tenant) notFound();

  const [{ count: orderCount }, { count: riderCount }, { data: statusRows }] = await Promise.all([
    service.from("orders").select("id", { count: "exact", head: true }).eq("tenant_id", id),
    service.from("riders").select("id", { count: "exact", head: true }).eq("tenant_id", id),
    service.from("orders").select("status").eq("tenant_id", id),
  ]);

  const activeOrders = (statusRows ?? []).filter((o) =>
    ["assigned", "in_transit", "arrived", "pending_confirmation"].includes(o.status)
  ).length;
  const flaggedOrders = (statusRows ?? []).filter((o) => o.status === "flagged_review").length;

  return (
    <TenantOverviewPanel
      tenant={tenant}
      stats={{
        orderCount: orderCount ?? 0,
        riderCount: riderCount ?? 0,
        activeOrders,
        flaggedOrders,
      }}
    />
  );
}
