import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireOpsUserApi } from "@/lib/ops/authGuardApi";
import { generateTrackingToken, generatePin, hashPin } from "@/lib/tokens";
import { sendRiderLink, sendRiderPin, sendCustomerLink, isTestNotificationProvider } from "@/lib/notify";
import { TOKEN_TIME_BUDGET_HOURS } from "@/lib/config";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireOpsUserApi();
  if ("error" in guard) return guard.error;
  const { id: orderId } = await params;
  const { riderId, confirmReassign } = await req.json();

  if (!riderId) {
    return NextResponse.json({ status: "invalid_request" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, status, assigned_rider_id")
    .eq("id", orderId)
    .single();

  if (!order) {
    return NextResponse.json({ status: "not_found" }, { status: 404 });
  }
  if (order.status === "delivered" || order.status === "cancelled") {
    return NextResponse.json({ status: "order_closed" }, { status: 409 });
  }

  const { data: rider } = await supabase
    .from("riders")
    .select("id, name, phone")
    .eq("id", riderId)
    .single();
  if (!rider) {
    return NextResponse.json({ status: "rider_not_found" }, { status: 404 });
  }

  // An order should only ever have one active rider token at a time --
  // reassigning over an existing assignment requires explicit confirmation
  // rather than silently overwriting it (catches ops data-entry mistakes).
  const isReassignment = Boolean(order.assigned_rider_id);
  if (isReassignment && !confirmReassign) {
    return NextResponse.json({ status: "needs_confirmation" }, { status: 409 });
  }

  const expiresAt = new Date(Date.now() + TOKEN_TIME_BUDGET_HOURS * 3_600_000).toISOString();
  const riderTokenStr = generateTrackingToken();
  const pin = generatePin();
  const pinHash = await hashPin(pin);

  if (isReassignment) {
    await supabase
      .from("tracking_tokens")
      .update({ active: false, revoked_at: new Date().toISOString(), revoked_reason: "reassigned" })
      .eq("order_id", orderId)
      .eq("type", "rider")
      .eq("active", true);
  }

  const { data: newRiderToken, error: tokenError } = await supabase
    .from("tracking_tokens")
    .insert({ token: riderTokenStr, order_id: orderId, type: "rider", rider_id: riderId, expires_at: expiresAt })
    .select()
    .single();

  if (tokenError || !newRiderToken) {
    return NextResponse.json({ status: "error" }, { status: 500 });
  }

  await supabase
    .from("pin_codes")
    .insert({ rider_token_id: newRiderToken.id, order_id: orderId, pin_hash: pinHash });

  let customerTokenStr: string | null = null;
  if (!isReassignment) {
    customerTokenStr = generateTrackingToken();
    await supabase
      .from("tracking_tokens")
      .insert({ token: customerTokenStr, order_id: orderId, type: "customer", expires_at: null });
  }

  await supabase
    .from("orders")
    .update({
      assigned_rider_id: riderId,
      status: isReassignment ? order.status : "assigned",
      // Drives current-vs-queued ranking when a rider has multiple active
      // orders (see src/lib/orderQueue.ts) -- reassignment counts as a new
      // assignment relationship, so it re-ranks too, not just first-time.
      assigned_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  await sendRiderLink(rider.phone, riderTokenStr);
  await sendRiderPin(rider.phone, pin);
  if (customerTokenStr) {
    // Only sent on the very first assignment -- the customer token is
    // scoped to the order, not the rider, so reassignment never touches it.
    const { data: freshOrder } = await supabase
      .from("orders")
      .select("customer_phone")
      .eq("id", orderId)
      .single();
    if (freshOrder?.customer_phone) {
      await sendCustomerLink(freshOrder.customer_phone, customerTokenStr);
    }
  }

  // Only while no real SMS provider is connected -- once isTestNotificationProvider
  // flips to false (a real provider swapped in), this stops being included
  // and the PIN only ever reaches the rider via the actual SMS.
  return NextResponse.json({
    status: "ok",
    pin: isTestNotificationProvider ? pin : undefined,
  });
}
