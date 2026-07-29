import Link from "next/link";
import { requireMerchantUser } from "@/lib/merchant/authGuard";
import { createAuthServerClient } from "@/lib/supabase/serverAuth";
import { Button } from "@/components/ui/Button";
import { OrdersTable } from "@/components/ops/OrdersTable";

export default async function MerchantOrdersPage() {
  await requireMerchantUser();
  // Authenticated (anon key + this merchant's session JWT) client, NOT
  // service-role -- RLS's tenant_id policy is what actually scopes this
  // query to the merchant's own rows.
  const supabase = await createAuthServerClient();
  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, customer_name, customer_phone, delivery_address, address_detail, status, tracking_expired_unresolved, delivery_confirmed_by, review_flag_reason, created_at, riders:assigned_rider_id(name, license_plate)"
    )
    .order("created_at", { ascending: false });

  return (
    <div className="animate-slide-up">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Orders</h1>
        <Link href="/merchant/orders/new">
          <Button>+ New Order</Button>
        </Link>
      </div>
      <OrdersTable orders={orders ?? []} orderBasePath="/merchant/orders" />
    </div>
  );
}
