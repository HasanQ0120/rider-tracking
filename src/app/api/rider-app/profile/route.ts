import { NextResponse } from "next/server";
import { requireRiderApi } from "@/lib/riderApp/authGuardApi";

export async function GET(req: Request) {
  const auth = await requireRiderApi(req);
  if ("error" in auth) return auth.error;

  const { data: tenant, error: tenantError } = await auth.supabase
    .from("tenants")
    .select("merchant_id, name, primary_color, secondary_color, logo_url")
    .eq("id", auth.tenantId)
    .maybeSingle();

  if (tenantError) {
    console.error("[rider-app/profile] tenant lookup failed", tenantError);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }

  return NextResponse.json({
    status: "ok",
    rider: auth.rider,
    tenant: tenant
      ? {
          merchant_id: tenant.merchant_id,
          name: tenant.name,
          primary_color: tenant.primary_color,
          secondary_color: tenant.secondary_color,
          logo_url: tenant.logo_url,
        }
      : null,
  });
}
