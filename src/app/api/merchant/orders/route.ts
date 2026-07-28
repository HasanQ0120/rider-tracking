import { NextResponse } from "next/server";
import { requireMerchantUserApi } from "@/lib/merchant/authGuardApi";
import { createServiceClient } from "@/lib/supabase/service";
import { cleanPhoneInput, isValidPakistaniMobile } from "@/lib/phone";
import { runAutoAssignment } from "@/lib/autoAssign";

export async function POST(req: Request) {
  const guard = await requireMerchantUserApi();
  if ("error" in guard) return guard.error;

  const {
    customer_name,
    customer_phone,
    delivery_address,
    delivery_lat,
    delivery_lng,
    address_detail,
  } = await req.json();

  if (!customer_name || !customer_phone || !delivery_address) {
    return NextResponse.json({ status: "invalid_request" }, { status: 400 });
  }
  if (!isValidPakistaniMobile(customer_phone)) {
    return NextResponse.json({ status: "invalid_phone" }, { status: 400 });
  }

  // Insert via the authenticated (session JWT) client, not service-role --
  // the "merchant inserts own orders" RLS policy checking tenant_id against
  // this JWT's app_metadata claim is what actually enforces isolation here.
  const { data, error } = await guard.supabase
    .from("orders")
    .insert({
      tenant_id: guard.tenantId,
      customer_name,
      customer_phone: cleanPhoneInput(customer_phone),
      delivery_address,
      delivery_lat: delivery_lat ?? null,
      delivery_lng: delivery_lng ?? null,
      address_detail: address_detail?.trim() || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ status: "error" }, { status: 500 });

  // Auto-assignment needs tracking_tokens/pin_codes writes and an orders
  // update -- none of which the merchant's own RLS policies grant -- so it
  // runs on a service-role client, explicitly scoped to this one tenant_id
  // and orderId (not a general-purpose merchant session), same asymmetry
  // used by the inbound API/Phase 3 design.
  const service = createServiceClient();
  await runAutoAssignment(service, guard.tenantId, data.id);

  // Re-fetch rather than returning the pre-assignment `data` -- auto-assignment
  // (if it ran) updates assigned_rider_id/status on the row, and the caller
  // needs to see that, not the state from before the insert's own .select().
  const { data: finalOrder } = await service.from("orders").select().eq("id", data.id).single();

  return NextResponse.json({ order: finalOrder ?? data });
}
