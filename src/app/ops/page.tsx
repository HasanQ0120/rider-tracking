import Link from "next/link";
import { requireOpsUser } from "@/lib/ops/authGuard";
import { createServiceClient } from "@/lib/supabase/service";
import { Button } from "@/components/ui/Button";
import { OrdersTable } from "@/components/ops/OrdersTable";

export default async function OpsOrdersPage() {
  await requireOpsUser();
  const supabase = createServiceClient();
  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, customer_name, delivery_address, status, tracking_expired_unresolved, delivery_confirmed_by, review_flag_reason, created_at, riders:assigned_rider_id(name)"
    )
    .order("created_at", { ascending: false });

  return (
    <div className="animate-slide-up">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-brand-navy">Orders</h1>
        <Link href="/ops/orders/new">
          <Button>New Order</Button>
        </Link>
      </div>
      <OrdersTable orders={orders ?? []} />
    </div>
  );
}
