import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CONNECTION_LOST_TIMEOUT_S } from "@/lib/config";

const ACTIVE_STATUSES = ["assigned", "in_transit", "arrived"];

export type LocationSnapshot = {
  loc: { lat: number; lng: number; recordedAt: string } | null;
  isStale: boolean;
  pickup: { lat: number; lng: number } | null;
};

export type RiderLocationSnapshot = LocationSnapshot & { riderName: string };

// Same "freshest current_locations row across a rider's own active orders,
// no staleness cutoff on the read itself" sourcing already used by
// findRiderForAutoAssignment -- just exposed read-only here instead of used
// for ranking. `isStale` is computed for display purposes only (using the
// same CONNECTION_LOST_TIMEOUT_S threshold the customer/rider pages already
// use for "GPS signal lost"); it never filters the result out. Batches the
// lookups across all of `riderIds` in a handful of queries rather than one
// round-trip per rider, since the "Show All" map needs every rider at once.
export async function getAllRiderLocationSnapshots(
  supabase: SupabaseClient,
  riderIds: string[]
): Promise<Record<string, LocationSnapshot>> {
  if (riderIds.length === 0) return {};

  const { data: riders } = await supabase.from("riders").select("id, tenant_id").in("id", riderIds);
  if (!riders || riders.length === 0) return {};

  const tenantIds = [...new Set(riders.map((r) => r.tenant_id))];
  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, default_pickup_lat, default_pickup_lng")
    .in("id", tenantIds);
  const pickupByTenant = new Map(
    (tenants ?? []).map((t) => [
      t.id,
      t.default_pickup_lat != null && t.default_pickup_lng != null
        ? { lat: t.default_pickup_lat, lng: t.default_pickup_lng }
        : null,
    ])
  );

  const { data: activeOrders } = await supabase
    .from("orders")
    .select("id, assigned_rider_id")
    .in("assigned_rider_id", riderIds)
    .in("status", ACTIVE_STATUSES);

  const orderIdToRider = new Map((activeOrders ?? []).map((o) => [o.id, o.assigned_rider_id]));
  const orderIds = [...orderIdToRider.keys()];

  const { data: liveLocations } = orderIds.length
    ? await supabase.from("current_locations").select("order_id, lat, lng, recorded_at").in("order_id", orderIds)
    : { data: [] as { order_id: string; lat: number; lng: number; recorded_at: string }[] };

  const freshestByRider = new Map<string, { lat: number; lng: number; recorded_at: string }>();
  for (const l of liveLocations ?? []) {
    const riderId = orderIdToRider.get(l.order_id);
    if (!riderId) continue;
    const existing = freshestByRider.get(riderId);
    if (!existing || l.recorded_at > existing.recorded_at) freshestByRider.set(riderId, l);
  }

  const result: Record<string, LocationSnapshot> = {};
  for (const rider of riders) {
    const pickup = pickupByTenant.get(rider.tenant_id) ?? null;
    const freshest = freshestByRider.get(rider.id);
    if (!freshest) {
      result[rider.id] = { loc: null, isStale: false, pickup };
      continue;
    }
    const ageSeconds = (Date.now() - new Date(freshest.recorded_at).getTime()) / 1000;
    result[rider.id] = {
      loc: { lat: freshest.lat, lng: freshest.lng, recordedAt: freshest.recorded_at },
      isStale: ageSeconds > CONNECTION_LOST_TIMEOUT_S,
      pickup,
    };
  }
  return result;
}

export async function getRiderLocationSnapshot(
  supabase: SupabaseClient,
  riderId: string
): Promise<RiderLocationSnapshot | null> {
  const { data: rider } = await supabase.from("riders").select("name").eq("id", riderId).maybeSingle();
  if (!rider) return null;

  const snapshots = await getAllRiderLocationSnapshots(supabase, [riderId]);
  const snapshot = snapshots[riderId] ?? { loc: null, isStale: false, pickup: null };
  return { riderName: rider.name, ...snapshot };
}
