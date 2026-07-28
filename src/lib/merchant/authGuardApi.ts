import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuthServerClient } from "@/lib/supabase/serverAuth";
import { createServiceClient } from "@/lib/supabase/service";

export type MerchantApiContext = {
  tenantId: string;
  merchantId: string;
  // The request-scoped, cookie-authenticated client (anon key + this
  // merchant's own session JWT) -- NOT service-role. Callers should use
  // this for the actual orders/riders insert so the merchant-scoped RLS
  // policies (tenant_id = auth.jwt() app_metadata claim) are the thing
  // that's actually enforcing isolation, not just this guard's own check.
  supabase: SupabaseClient;
};

// API-route variant of requireMerchantUser(): returns a 401 JSON response
// instead of redirect()-ing, mirroring requireOpsUserApi().
export async function requireMerchantUserApi(): Promise<
  MerchantApiContext | { error: NextResponse }
> {
  const authClient = await createAuthServerClient();
  const { data } = await authClient.auth.getUser();
  if (!data.user) {
    return { error: NextResponse.json({ status: "unauthorized" }, { status: 401 }) };
  }

  const tenantId = data.user.app_metadata?.tenant_id as string | undefined;
  if (!tenantId || data.user.app_metadata?.role !== "merchant") {
    return { error: NextResponse.json({ status: "unauthorized" }, { status: 401 }) };
  }

  const service = createServiceClient();
  const { data: tenant } = await service
    .from("tenants")
    .select("id, merchant_id, active")
    .eq("id", tenantId)
    .maybeSingle();

  if (!tenant || !tenant.active) {
    return { error: NextResponse.json({ status: "unauthorized" }, { status: 401 }) };
  }

  return { tenantId: tenant.id, merchantId: tenant.merchant_id, supabase: authClient };
}
