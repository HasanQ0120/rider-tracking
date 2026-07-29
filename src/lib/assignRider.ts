import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateTrackingToken, generatePin, hashPin } from "@/lib/tokens";
import { sendRiderLink, sendRiderPin, sendCustomerLink, isTestNotificationProvider } from "@/lib/notify";
import { TOKEN_TIME_BUDGET_HOURS } from "@/lib/config";

// Shared by ops's manual "Assign Rider" action and auto-assignment at order
// creation time -- both need the exact same tracking-token/PIN/customer-link
// issuance, or an assignment would silently produce an order with
// assigned_rider_id set but no functioning tracking link for the rider.
//
// Independent steps run concurrently where it's actually safe (bcrypt
// hashing alongside the revoke+insert chain; then pin_codes alongside the
// independent customer-token insert; then all notification sends
// together) -- this was previously a fully sequential chain, which is
// exactly the kind of "button takes seconds to respond" latency this
// exists to fix, confirmed by measuring the endpoint before and after.
//
// The reassignment revoke and the new rider-token insert must NOT run
// concurrently with each other, though -- a live timing test caught this:
// `tracking_tokens` has a partial unique index, one_active_rider_token_per_order
// (order_id) where type='rider' and active, so if the insert's transaction
// lands before the revoke's, the insert gets rejected with a unique
// violation. That's a real DB-level dependency between two steps that look
// independent at the JS level; only bcrypt hashing (no DB dependency at
// all) actually overlaps with that chain. Two orderings also stay
// strictly sequential on purpose regardless of performance: the orders
// update only happens once every token/pin row is confirmed to exist (so
// "assigned_rider_id is set" always implies a working token exists for
// it), and notifications only fire after that update succeeds (never
// notify before something is actually persisted).
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

  // No DB dependency at all -- safe to run alongside the revoke+insert
  // chain below rather than blocking in front of it.
  const hashPromise = hashPin(pin);

  if (isReassignment) {
    // Must complete before the insert below (see the unique-index note
    // above) -- this ordering is a real constraint, not just leftover
    // caution from the pre-parallelization code.
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

  const pinHash = await hashPromise;

  const pinCodesPromise = supabase
    .from("pin_codes")
    .insert({ rider_token_id: newRiderToken.id, order_id: orderId, pin_hash: pinHash });

  let customerTokenStr: string | null = null;
  if (!isReassignment) {
    customerTokenStr = generateTrackingToken();
    await Promise.all([
      pinCodesPromise,
      supabase
        .from("tracking_tokens")
        .insert({ token: customerTokenStr, order_id: orderId, type: "customer", expires_at: null }),
    ]);
  } else {
    await pinCodesPromise;
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

  await Promise.all([
    sendRiderLink(riderPhone, riderTokenStr),
    sendRiderPin(riderPhone, pin),
    // Only sent on the very first assignment -- the customer token is
    // scoped to the order, not the rider, so reassignment never touches it.
    customerTokenStr && customerPhone
      ? sendCustomerLink(customerPhone, customerTokenStr)
      : Promise.resolve(),
  ]);

  // Only while no real SMS provider is connected -- once isTestNotificationProvider
  // flips to false (a real provider swapped in), callers stop surfacing the PIN.
  return isTestNotificationProvider ? pin : null;
}
