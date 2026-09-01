import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CONNECTION_LOST_TIMEOUT_S } from "@/lib/config";
import { generateSessionId } from "@/lib/tokens";
import type { RiderOrderRow } from "@/lib/riderApp/orders";

export async function loadRiderOrder(
  supabase: SupabaseClient,
  orderId: string,
  riderId: string,
  columns: string
): Promise<RiderOrderRow | null> {
  const { data, error } = await supabase
    .from("orders")
    .select(columns)
    .eq("id", orderId)
    .eq("assigned_rider_id", riderId)
    .maybeSingle();

  if (error || !data) return null;
  return data as RiderOrderRow;
}

export async function loadActiveRiderTokenForOrder(
  supabase: SupabaseClient,
  orderId: string,
  riderId: string
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from("tracking_tokens")
    .select("id")
    .eq("order_id", orderId)
    .eq("type", "rider")
    .eq("rider_id", riderId)
    .eq("active", true)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

export type StartDeliveryResult =
  | { ok: true; sessionId: string; resuming: boolean; order: RiderOrderRow }
  | { ok: false; code: string; status: number };

// Begins or resumes GPS tracking for an assigned order. Reuses the existing
// tracking_sessions table (keyed off the per-order rider tracking_token that
// assignment already creates) so Step 3's location route can share the same
// session enforcement without a parallel session store.
export async function startDeliverySession(
  supabase: SupabaseClient,
  order: RiderOrderRow,
  riderId: string
): Promise<StartDeliveryResult> {
  if (order.status === "delivered" || order.status === "cancelled") {
    return { ok: false, code: "closed", status: 409 };
  }
  if (order.status === "flagged_review") {
    return { ok: false, code: "flagged", status: 409 };
  }

  const riderToken = await loadActiveRiderTokenForOrder(supabase, order.id, riderId);
  if (!riderToken) {
    return { ok: false, code: "no_tracking_token", status: 409 };
  }

  const { data: recentLocation } = await supabase
    .from("current_locations")
    .select("recorded_at")
    .eq("order_id", order.id)
    .maybeSingle();
  const isLive =
    !!recentLocation &&
    Date.now() - new Date(recentLocation.recorded_at).getTime() < CONNECTION_LOST_TIMEOUT_S * 1000;

  if (isLive) {
    const { data: activeSession } = await supabase
      .from("tracking_sessions")
      .select("session_id")
      .eq("rider_token_id", riderToken.id)
      .eq("is_active", true)
      .maybeSingle();
    if (activeSession) {
      return { ok: true, sessionId: activeSession.session_id, resuming: true, order };
    }
  }

  const sessionId = generateSessionId();
  await supabase
    .from("tracking_sessions")
    .update({ is_active: false, superseded_at: new Date().toISOString() })
    .eq("rider_token_id", riderToken.id)
    .eq("is_active", true);

  const { error: insertError } = await supabase.from("tracking_sessions").insert({
    rider_token_id: riderToken.id,
    session_id: sessionId,
  });
  if (insertError) {
    console.error("[rider-app/start] failed to create tracking session", insertError);
    return { ok: false, code: "session_error", status: 500 };
  }

  if (order.status === "assigned") {
    const { error: statusError } = await supabase
      .from("orders")
      .update({ status: "in_transit" })
      .eq("id", order.id);
    if (statusError) {
      console.error("[rider-app/start] failed to set in_transit", statusError);
      return { ok: false, code: "status_error", status: 500 };
    }
    order = { ...order, status: "in_transit" };
  }

  return { ok: true, sessionId, resuming: false, order };
}
