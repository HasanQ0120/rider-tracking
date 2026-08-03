import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CONNECTION_LOST_TIMEOUT_S } from "@/lib/config";

const ACTIVE_STATUSES = ["assigned", "in_transit", "arrived"];

export type RiderLocationSnapshot = {
  riderName: string;
  loc: { lat: number; lng: number; recordedAt: string } | null;
  isStale: boolean;
  pickup: { lat: number; lng: number } | null;
};

// Same "freshest current_locations row across a rider's own active orders,
// no staleness cutoff on the read itself" sourcing already used by
// findRiderForAutoAssignment -- just exposed read-only here instead of used
// for ranking. `isStale` is computed for display purposes only (using the
// same CONNECTION_LOST_TIMEOUT_S threshold the customer/rider pages already
// use for "GPS signal lost"); it never filters the result out.
export async function getRiderLocationSnapshot(
  supabase: SupabaseClient,
  riderId: string
): Promise<RiderLocationSnapshot | null> {
  const { data: rider } = await supabase
    .from("riders")
    .select("name, tenant_id")
    .eq("id", riderId)
    .maybeSingle();
  if (!rider) return null;

  const { data: tenant } = await supabase
    .from("tenants")
    .select("default_pickup_lat, default_pickup_lng")
    .eq("id", rider.tenant_id)
    .maybeSingle();
  const pickup =
    tenant?.default_pickup_lat != null && tenant?.default_pickup_lng != null
      ? { lat: tenant.default_pickup_lat, lng: tenant.default_pickup_lng }
      : null;

  const { data: activeOrders } = await supabase
    .from("orders")
    .select("id")
    .eq("assigned_rider_id", riderId)
    .in("status", ACTIVE_STATUSES);

  const orderIds = (activeOrders ?? []).map((o) => o.id);
  if (orderIds.length === 0) {
    return { riderName: rider.name, loc: null, isStale: false, pickup };
  }

  const { data: liveLocations } = await supabase
    .from("current_locations")
    .select("lat, lng, recorded_at")
    .in("order_id", orderIds);

  let freshest: { lat: number; lng: number; recorded_at: string } | null = null;
  for (const l of liveLocations ?? []) {
    if (!freshest || l.recorded_at > freshest.recorded_at) freshest = l;
  }

  if (!freshest) {
    return { riderName: rider.name, loc: null, isStale: false, pickup };
  }

  const ageSeconds = (Date.now() - new Date(freshest.recorded_at).getTime()) / 1000;
  return {
    riderName: rider.name,
    loc: { lat: freshest.lat, lng: freshest.lng, recordedAt: freshest.recorded_at },
    isStale: ageSeconds > CONNECTION_LOST_TIMEOUT_S,
    pickup,
  };
}
