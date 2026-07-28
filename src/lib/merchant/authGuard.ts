import "server-only";
import { redirect } from "next/navigation";
import { createAuthServerClient } from "@/lib/supabase/serverAuth";
import { createServiceClient } from "@/lib/supabase/service";

export type MerchantUser = {
  tenantId: string;
  merchantId: string;
  name: string;
  autoAssignEnabled: boolean;
};

// Merchants are provisioned by direct SQL (service-role), same as
// ops_staff -- there's no self-service signup. tenant_id lives in this
// user's Supabase Auth app_metadata (settable only via the service-role
// admin API), which is what every merchant-scoped RLS policy actually
// checks -- this guard just confirms the session is real and the tenant
// is still active before rendering anything.
export async function requireMerchantUser(): Promise<MerchantUser> {
  const authClient = await createAuthServerClient();
  const { data } = await authClient.auth.getUser();
  if (!data.user) redirect("/merchant/login");

  const tenantId = data.user.app_metadata?.tenant_id as string | undefined;
  if (!tenantId || data.user.app_metadata?.role !== "merchant") {
    redirect("/merchant/login?error=not_authorized");
  }

  // Service-role only for this one lookup (tenant display info, not
  // orders/riders) -- confirms the tenant hasn't been deactivated since
  // the session was issued.
  const service = createServiceClient();
  const { data: tenant } = await service
    .from("tenants")
    .select("id, merchant_id, name, active, auto_assign_enabled")
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
  };
}
