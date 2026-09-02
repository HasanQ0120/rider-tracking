import { MerchantDashboardShell } from "@/components/merchant/MerchantDashboardShell";
import { requireMerchantUser } from "@/lib/merchant/authGuard";

export default async function MerchantLayout({ children }: { children: React.ReactNode }) {
  const merchant = await requireMerchantUser();

  return (
    <MerchantDashboardShell
      merchantName={merchant.name}
      merchantId={merchant.merchantId}
      branding={merchant.branding}
    >
      {children}
    </MerchantDashboardShell>
  );
}
