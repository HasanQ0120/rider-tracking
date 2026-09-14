import { requireMerchantUser } from "@/lib/merchant/authGuard";
import { serverApi } from "@/lib/api/server";
import { AccountPasswordForm } from "@/components/merchant/AccountPasswordForm";
import { MerchantPageHeader } from "@/components/merchant/MerchantUi";
import { TenantLogo } from "@/components/merchant/TenantLogo";

export default async function MerchantAccountPage() {
  const merchant = await requireMerchantUser();
  const api = await serverApi("/merchant/login");

  const [{ data: ridersRes }, { data: ordersRes }] = await Promise.all([
    api.get<{ status: string; riders: { id: string }[] }>("/api/merchant/riders"),
    api.get<{ status: string; orders: { created_at: string }[] }>("/api/merchant/orders"),
  ]);

  const riderCount = ridersRes.riders?.length ?? 0;
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const monthOrders = (ordersRes.orders ?? []).filter(
    (o) => new Date(o.created_at) >= startOfMonth
  ).length;

  return (
    <>
      <MerchantPageHeader title="Account" />

      <div className="space-y-6">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div
            className="flex flex-wrap items-center justify-between gap-4 px-6 py-5"
            style={{ backgroundColor: "var(--merchant-primary)" }}
          >
            <div className="flex items-center gap-4">
              <TenantLogo
                name={merchant.name}
                logoUrl={merchant.branding.logoUrl}
                size={56}
                accentColor={merchant.branding.secondaryColor}
              />
              <div>
                <p className="text-lg font-bold text-white">{merchant.name}</p>
                <p className="text-sm text-white/70">Merchant admin</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/50">
                Merchant ID
              </p>
              <p className="font-mono text-sm text-white">{merchant.merchantId}</p>
            </div>
          </div>
          <div className="grid divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="px-6 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Riders</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{riderCount}</p>
            </div>
            <div className="px-6 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Orders this month
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{monthOrders}</p>
            </div>
            <div className="px-6 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Auto-assign
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {merchant.autoAssignEnabled ? "On" : "Off"}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <AccountPasswordForm />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="font-semibold text-slate-900">Sessions</h3>
          <p className="mt-1 text-sm text-slate-500">Active sign-ins for this merchant account.</p>
          <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <div>
                  <p className="text-sm font-medium text-slate-900">This device</p>
                  <p className="text-xs text-slate-500">Active now</p>
                </div>
              </div>
              <span className="text-xs font-semibold text-emerald-700">Current</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
