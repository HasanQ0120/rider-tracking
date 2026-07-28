import { requireMerchantUser } from "@/lib/merchant/authGuard";
import { AccountPasswordForm } from "@/components/merchant/AccountPasswordForm";

export default async function MerchantAccountPage() {
  const merchant = await requireMerchantUser();
  return (
    <div className="mx-auto max-w-md animate-slide-up">
      <h1 className="mb-6 text-2xl font-semibold text-white">Account</h1>
      <div className="mb-6 rounded-xl border border-white/10 bg-surface-raised p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/50">Merchant ID</p>
        <p className="mt-1 font-mono text-white">{merchant.merchantId}</p>
      </div>
      <AccountPasswordForm />
    </div>
  );
}
