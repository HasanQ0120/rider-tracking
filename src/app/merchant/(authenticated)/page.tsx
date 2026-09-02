import Link from "next/link";
import { requireMerchantUser } from "@/lib/merchant/authGuard";
import { createAuthServerClient } from "@/lib/supabase/serverAuth";
import { MerchantContentCard, MerchantPageHeader } from "@/components/merchant/MerchantUi";
import { OrdersTable } from "@/components/ops/OrdersTable";

export default async function MerchantOrdersPage() {
  await requireMerchantUser();
  const supabase = await createAuthServerClient();
  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, customer_name, customer_phone, delivery_address, address_detail, status, tracking_expired_unresolved, delivery_confirmed_by, review_flag_reason, created_at, riders:assigned_rider_id(name, license_plate)"
    )
    .order("created_at", { ascending: false });

  const list = orders ?? [];
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todayCount = list.filter((o) => new Date(o.created_at) >= startOfDay).length;
  const flaggedCount = list.filter((o) => o.status === "flagged_review").length;

  return (
    <>
      <MerchantPageHeader
        title="Orders"
        subtitle={
          <>
            {todayCount} order{todayCount === 1 ? "" : "s"} today
            {flaggedCount > 0 ? (
              <>
                {" "}
                · {flaggedCount} flagged for review
              </>
            ) : null}
          </>
        }
        actions={
          <Link
            href="/merchant/settings"
            className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            API integration
          </Link>
        }
      />

      <MerchantContentCard>
        <OrdersTable orders={list} orderBasePath="/merchant/orders" variant="light" />
      </MerchantContentCard>
    </>
  );
}
