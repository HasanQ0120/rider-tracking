import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { haversineMeters } from "@/lib/geo";
import { PROXIMITY_RADIUS_M } from "@/lib/config";
import { loadRiderOrder } from "@/lib/riderApp/delivery";

export type CompleteDeliveryResult =
  | { ok: true; status: "pending_confirmation" }
  | { ok: true; status: "flagged"; reason: "far_from_address" }
  | { ok: false; code: string; status: number };

export async function completeRiderDelivery(
  supabase: SupabaseClient,
  orderId: string,
  riderId: string
): Promise<CompleteDeliveryResult> {
  const order = await loadRiderOrder(
    supabase,
    orderId,
    riderId,
    "id, status, delivery_lat, delivery_lng"
  );
  if (!order) {
    return { ok: false, code: "not_found", status: 404 };
  }
  if (order.status === "delivered" || order.status === "cancelled") {
    return { ok: false, code: "closed", status: 409 };
  }
  if (order.status === "pending_confirmation") {
    return { ok: false, code: "already_pending", status: 409 };
  }

  const { data: loc } = await supabase
    .from("current_locations")
    .select("lat, lng")
    .eq("order_id", order.id)
    .maybeSingle();

  const withinRadius =
    loc != null &&
    order.delivery_lat != null &&
    order.delivery_lng != null &&
    haversineMeters(order.delivery_lat, order.delivery_lng, loc.lat, loc.lng) <= PROXIMITY_RADIUS_M;

  if (withinRadius) {
    const { error } = await supabase.rpc("set_pending_confirmation", { p_order_id: order.id });
    if (error) {
      console.error("[rider-app/complete] set_pending_confirmation failed", error);
      return { ok: false, code: "error", status: 500 };
    }
    return { ok: true, status: "pending_confirmation" };
  }

  const { error } = await supabase.rpc("flag_order_for_review", {
    p_order_id: order.id,
    p_reason: "far_from_address",
  });
  if (error) {
    console.error("[rider-app/complete] flag_order_for_review failed", error);
    return { ok: false, code: "error", status: 500 };
  }
  return { ok: true, status: "flagged", reason: "far_from_address" };
}

export type MarkArrivedResult = { ok: true } | { ok: false; code: string; status: number };

export async function markRiderArrived(
  supabase: SupabaseClient,
  orderId: string,
  riderId: string
): Promise<MarkArrivedResult> {
  const order = await loadRiderOrder(supabase, orderId, riderId, "id, status");
  if (!order) {
    return { ok: false, code: "not_found", status: 404 };
  }
  if (order.status === "delivered" || order.status === "cancelled") {
    return { ok: false, code: "closed", status: 409 };
  }

  const { error } = await supabase
    .from("orders")
    .update({ status: "arrived", rider_arrived_at: new Date().toISOString() })
    .eq("id", order.id)
    .not("status", "in", "(delivered,cancelled)");

  if (error) {
    console.error("[rider-app/arrived] update failed", error);
    return { ok: false, code: "error", status: 500 };
  }

  return { ok: true };
}
