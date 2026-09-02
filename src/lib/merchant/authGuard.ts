import "server-only";
import { redirect } from "next/navigation";
import { createAuthServerClient } from "@/lib/supabase/serverAuth";
import { createServiceClient } from "@/lib/supabase/service";
import { brandingFromRow, type TenantBranding } from "@/lib/merchant/branding";

export type MerchantUser = {
  tenantId: string;
  merchantId: string;
  name: string;
  autoAssignEnabled: boolean;
  branding: TenantBranding;
};

export async function requireMerchantUser(): Promise<MerchantUser> {
  const authClient = await createAuthServerClient();
  const { data } = await authClient.auth.getUser();
  if (!data.user) redirect("/merchant/login");

  const tenantId = data.user.app_metadata?.tenant_id as string | undefined;
  if (!tenantId || data.user.app_metadata?.role !== "merchant") {
    redirect("/merchant/login?error=not_authorized");
  }

  const service = createServiceClient();
  const { data: tenant } = await service
    .from("tenants")
    .select(
      "id, merchant_id, name, active, auto_assign_enabled, logo_url, primary_color, secondary_color, accent_color"
    )
    .eq("id", tenantId)
    .maybeSingle();

  if (!tenant || !tenant.active) {
    redirect("/merchant/login?error=not_authorized");
  }

  return {
    tenantId: tenant.id,
    merchantId: tenant.merchant_id,
    name: tenant.name,
    autoAssignEnabled: tenant.auto_assign_enabled,
    branding: brandingFromRow(tenant),
  };
}
