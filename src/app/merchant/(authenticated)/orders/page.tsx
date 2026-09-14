import Link from "next/link";
import { requireMerchantUser } from "@/lib/merchant/authGuard";
import { serverApi } from "@/lib/api/server";
import { MerchantContentCard, MerchantPageHeader } from "@/components/merchant/MerchantUi";
import { OrdersTable } from "@/components/ops/OrdersTable";

export default async function MerchantOrdersPage() {
  await requireMerchantUser();
  const api = await serverApi("/merchant/login");
  const { data } = await api.get<{
    status: string;
    orders: Parameters<typeof OrdersTable>[0]["orders"];
  }>("/api/merchant/orders");

  const list = data.orders ?? [];
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
