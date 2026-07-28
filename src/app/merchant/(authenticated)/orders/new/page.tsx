import Link from "next/link";
import { requireMerchantUser } from "@/lib/merchant/authGuard";
import { MerchantNewOrderForm } from "@/components/merchant/MerchantNewOrderForm";

export default async function MerchantNewOrderPage() {
  await requireMerchantUser();
  return (
    <div className="animate-slide-up">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/merchant"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Back to Orders"
        >
          ←
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-white">New Order</h1>
          <p className="text-sm text-white/50">Fill in details and pin the delivery location</p>
        </div>
      </div>
      <MerchantNewOrderForm />
    </div>
  );
}
