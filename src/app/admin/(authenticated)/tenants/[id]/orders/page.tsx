import { notFound } from "next/navigation";
import { MerchantContentCard } from "@/components/merchant/MerchantUi";
import { OrdersTable } from "@/components/ops/OrdersTable";
import { createServiceClient } from "@/lib/supabase/service";

type PageProps = { params: Promise<{ id: string }> };

export default async function TenantOrdersPage({ params }: PageProps) {
  const { id } = await params;
  const service = createServiceClient();

  const { data: tenant } = await service.from("tenants").select("id").eq("id", id).maybeSingle();
  if (!tenant) notFound();

  const { data: orders } = await service
    .from("orders")
    .select(
      "id, customer_name, customer_phone, delivery_address, address_detail, status, tracking_expired_unresolved, delivery_confirmed_by, review_flag_reason, created_at, riders:assigned_rider_id(name, license_plate)"
    )
    .eq("tenant_id", id)
    .order("created_at", { ascending: false });

  return (
    <MerchantContentCard
      title="Orders"
      subtitle="View and manage this merchant's deliveries. New orders come from Merchant / API only."
    >
      <OrdersTable
        orders={orders ?? []}
        orderBasePath={`/admin/tenants/${id}/orders`}
        variant="light"
      />
    </MerchantContentCard>
  );
}
