import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateTrackingToken, generatePin, hashPin } from "@/lib/tokens";
import { sendRiderLink, sendRiderPin, sendCustomerLink, isTestNotificationProvider } from "@/lib/notify";
import { TOKEN_TIME_BUDGET_HOURS } from "@/lib/config";

// Shared by ops's manual "Assign Rider" action and auto-assignment at order
// creation time -- both need the exact same tracking-token/PIN/customer-link
// issuance, or an assignment would silently produce an order with
// assigned_rider_id set but no functioning tracking link for the rider.
export async function performRiderAssignment(
  supabase: SupabaseClient,
  params: {
    orderId: string;
    riderId: string;
    riderPhone: string;
    customerPhone: string | null;
    isReassignment: boolean;
  }
): Promise<string | null> {
  const { orderId, riderId, riderPhone, customerPhone, isReassignment } = params;

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
    throw new Error("Failed to create rider tracking token");
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

  const updatePayload: Record<string, unknown> = {
    assigned_rider_id: riderId,
    // Drives current-vs-queued ranking when a rider has multiple active
    // orders (see src/lib/orderQueue.ts) -- reassignment counts as a new
    // assignment relationship, so it re-ranks too, not just first-time.
    assigned_at: new Date().toISOString(),
  };
  if (!isReassignment) updatePayload.status = "assigned";
  await supabase.from("orders").update(updatePayload).eq("id", orderId);

  await sendRiderLink(riderPhone, riderTokenStr);
  await sendRiderPin(riderPhone, pin);
  if (customerTokenStr && customerPhone) {
    // Only sent on the very first assignment -- the customer token is
    // scoped to the order, not the rider, so reassignment never touches it.
    await sendCustomerLink(customerPhone, customerTokenStr);
  }

  // Only while no real SMS provider is connected -- once isTestNotificationProvider
  // flips to false (a real provider swapped in), callers stop surfacing the PIN.
  return isTestNotificationProvider ? pin : null;
}
