import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isActiveSession } from "@/lib/rider/shared";
import { computeSpeedKmh, isSpeedImplausible, computeBearing, haversineMeters } from "@/lib/geo";
import {
  MAX_ACCURACY_M,
  LOCATION_MIN_INTERVAL_MS,
  MIN_HEADING_UPDATE_DISTANCE_M,
} from "@/lib/config";
import { loadActiveRiderTokenForOrder, loadRiderOrder } from "@/lib/riderApp/delivery";

export type RecordLocationInput = {
  lat: number;
  lng: number;
  accuracy_m: number;
  session_id: string;
};

export type RecordLocationResult =
  | {
      ok: true;
      speedImplausible: boolean;
      heading: number | null;
      speedKmh: number | null;
    }
  | { ok: false; code: string; status: number };

export async function recordRiderLocation(
  supabase: SupabaseClient,
  orderId: string,
  riderId: string,
  input: RecordLocationInput
): Promise<RecordLocationResult> {
  const { lat, lng, accuracy_m, session_id } = input;

  const order = await loadRiderOrder(supabase, orderId, riderId, "id, status");
  if (!order) {
    return { ok: false, code: "not_found", status: 404 };
  }
  if (order.status === "delivered" || order.status === "cancelled") {
    return { ok: false, code: "closed", status: 409 };
  }

  const riderToken = await loadActiveRiderTokenForOrder(supabase, orderId, riderId);
  if (!riderToken) {
    return { ok: false, code: "no_tracking_token", status: 409 };
  }

  if (!(await isActiveSession(supabase, riderToken.id, session_id))) {
    return { ok: false, code: "session_superseded", status: 409 };
  }

  if (accuracy_m > MAX_ACCURACY_M) {
    return { ok: false, code: "inaccurate", status: 200 };
  }

  const { data: previous } = await supabase
    .from("current_locations")
    .select("lat, lng, recorded_at, heading")
    .eq("order_id", order.id)
    .maybeSingle();

  const now = new Date();
  if (previous) {
    const elapsedMs = now.getTime() - new Date(previous.recorded_at).getTime();
    if (elapsedMs < LOCATION_MIN_INTERVAL_MS) {
      return { ok: false, code: "rate_limited", status: 200 };
    }
  }

  let speedKmh: number | null = null;
  let speedImplausible = false;
  let heading: number | null = null;
  if (previous) {
    speedKmh = computeSpeedKmh(
      previous.lat,
      previous.lng,
      new Date(previous.recorded_at),
      lat,
      lng,
      now
    );
    speedImplausible = isSpeedImplausible(speedKmh);

    const movedMeters = haversineMeters(previous.lat, previous.lng, lat, lng);
    heading =
      movedMeters >= MIN_HEADING_UPDATE_DISTANCE_M
        ? computeBearing(previous.lat, previous.lng, lat, lng)
        : previous.heading ?? null;
  }

  const { error: upsertError } = await supabase.from("current_locations").upsert({
    order_id: order.id,
    lat,
    lng,
    accuracy_m,
    speed_kmh: speedKmh,
    speed_implausible: speedImplausible,
    heading,
    session_id,
    recorded_at: now.toISOString(),
  });
  if (upsertError) {
    console.error("[rider-app/location] failed to write current_locations", upsertError);
    return { ok: false, code: "error", status: 500 };
  }

  const { error: historyError } = await supabase.from("location_history").insert({
    order_id: order.id,
    lat,
    lng,
    accuracy_m,
    speed_kmh: speedKmh,
    recorded_at: now.toISOString(),
  });
  if (historyError) {
    console.error("[rider-app/location] failed to write location_history", historyError);
  }

  if (order.status === "assigned") {
    await supabase.from("orders").update({ status: "in_transit" }).eq("id", order.id);
  }

  return { ok: true, speedImplausible, heading, speedKmh };
}
