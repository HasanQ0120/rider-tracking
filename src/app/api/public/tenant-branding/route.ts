import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { brandingFromRow } from "@/lib/merchant/branding";

/** Public read-only tenant branding for merchant login screen (no secrets). */
export async function GET(req: Request) {
  const merchantId = new URL(req.url).searchParams.get("merchant_id")?.trim();
  if (!merchantId) {
    return NextResponse.json({ status: "invalid_request" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("name, merchant_id, active, suspended_at, logo_url, primary_color, secondary_color, accent_color")
    .eq("merchant_id", merchantId)
    .maybeSingle();

  if (!tenant || !tenant.active || tenant.suspended_at) {
    return NextResponse.json({ status: "not_found" }, { status: 404 });
  }

  const branding = brandingFromRow(tenant);
  return NextResponse.json({
    status: "ok",
    name: tenant.name,
    merchant_id: tenant.merchant_id,
    branding: {
      logo_url: branding.logoUrl,
      primary_color: branding.primaryColor,
      secondary_color: branding.secondaryColor,
      accent_color: branding.accentColor,
    },
  });
}
