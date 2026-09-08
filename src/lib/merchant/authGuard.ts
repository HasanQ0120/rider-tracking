import "server-only";
import { redirect } from "next/navigation";
import { apiWithToken } from "@/lib/api/client";
import { getSessionTokenFromCookies, getVerifiedPortalSession } from "@/lib/api/session";
import { brandingFromRow, type TenantBranding } from "@/lib/merchant/branding";

export type MerchantUser = {
  tenantId: string;
  merchantId: string;
  name: string;
  autoAssignEnabled: boolean;
  branding: TenantBranding;
};

export async function requireMerchantUser(): Promise<MerchantUser> {
  const session = await getVerifiedPortalSession();
  if (!session) redirect("/merchant/login");
  if (session.role !== "merchant" || !session.tenantId) {
    redirect("/merchant/login?error=not_authorized");
  }

  const token = await getSessionTokenFromCookies();
  if (!token) redirect("/merchant/login");

  try {
    const { data } = await apiWithToken(token).get<{
      status: string;
      user: {
        tenant_id: string | null;
        merchant_id: string | null;
        tenant_name: string | null;
        auto_assign_enabled: boolean | null;
        branding: {
          logo_url: string | null;
          primary_color: string;
          secondary_color: string;
          accent_color: string;
        } | null;
      };
    }>("/api/auth/me");

    if (data.status !== "ok" || !data.user.tenant_id || !data.user.merchant_id) {
      redirect("/merchant/login?error=not_authorized");
    }

    return {
      tenantId: data.user.tenant_id,
      merchantId: data.user.merchant_id,
      name: data.user.tenant_name ?? data.user.merchant_id,
      autoAssignEnabled: Boolean(data.user.auto_assign_enabled),
      branding: brandingFromRow(data.user.branding ?? {}),
    };
  } catch {
    redirect("/merchant/login?error=not_authorized");
  }
}
