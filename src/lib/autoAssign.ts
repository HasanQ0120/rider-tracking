import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { haversineMeters } from "@/lib/geo";
import { performRiderAssignment } from "@/lib/assignRider";
import { AUTO_ASSIGN_RADIUS_M, AUTO_ASSIGN_DESTINATION_RADIUS_M } from "@/lib/config";

const ACTIVE_STATUSES = ["assigned", "in_transit", "arrived"];

type Position = { lat: number; lng: number; recordedAt: string };

// Every active rider is a candidate -- there's no separate "on duty" state
// gating eligibility (removed entirely; riders are available by default).
// Ranked in four tiers, in order:
//   1. Riders within AUTO_ASSIGN_RADIUS_M of the pickup point (using each
//      rider's freshest current_locations reading from their own
//      in-progress orders -- the only location source there is now, since
//      idle riders have no separate ping to report one; no staleness
//      cutoff, deliberately "whatever's available"). Least busy, then
//      nearest.
//   2. Busy riders with an in-progress delivery whose destination is
//      within AUTO_ASSIGN_DESTINATION_RADIUS_M of THIS order's own
//      delivery point -- they're already heading that way. Checked before
//      the idle tier below: a busy rider we can confirm is nearby beats an
//      idle rider whose location is completely unknown. Least busy, then
//      nearest destination.
//   3. Any rider with zero active orders at all -- a blind pick (idle
//      riders report no position, so there's nothing to compare), used
//      only once tiers 1-2 find no positional evidence anywhere.
//   4. Least busy overall, any distance -- final catch-all.
// Returns null only if the tenant has no active riders at all.
export async function findRiderForAutoAssignment(
  supabase: SupabaseClient,
  tenantId: string,
  pickupLat: number,
  pickupLng: number,
  deliveryLat?: number | null,
  deliveryLng?: number | null
): Promise<string | null> {
  const { data: riders } = await supabase
    .from("riders")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("active", true);
  if (!riders || riders.length === 0) return null;
  const riderIds = riders.map((r) => r.id);

  const { data: activeOrders } = await supabase
    .from("orders")
    .select("id, assigned_rider_id, delivery_lat, delivery_lng")
    .eq("tenant_id", tenantId)
    .in("status", ACTIVE_STATUSES)
    .in("assigned_rider_id", riderIds);

  const busyCount = new Map<string, number>();
  const orderIdToRider = new Map<string, string>();
  const riderDestinations = new Map<string, { lat: number; lng: number }[]>();
  for (const o of activeOrders ?? []) {
    if (!o.assigned_rider_id) continue;
    busyCount.set(o.assigned_rider_id, (busyCount.get(o.assigned_rider_id) ?? 0) + 1);
    orderIdToRider.set(o.id, o.assigned_rider_id);
    if (o.delivery_lat != null && o.delivery_lng != null) {
      const destinations = riderDestinations.get(o.assigned_rider_id) ?? [];
      destinations.push({ lat: o.delivery_lat, lng: o.delivery_lng });
      riderDestinations.set(o.assigned_rider_id, destinations);
    }
  }

  const orderIds = [...orderIdToRider.keys()];
  const { data: liveLocations } = orderIds.length
    ? await supabase
        .from("current_locations")
        .select("order_id, lat, lng, recorded_at")
        .in("order_id", orderIds)
    : { data: [] as { order_id: string; lat: number; lng: number; recorded_at: string }[] };

  const bestPosition = new Map<string, Position>();
  for (const l of liveLocations ?? []) {
    const riderId = orderIdToRider.get(l.order_id);
    if (!riderId) continue;
    const existing = bestPosition.get(riderId);
    if (!existing || l.recorded_at > existing.recordedAt) {
      bestPosition.set(riderId, { lat: l.lat, lng: l.lng, recordedAt: l.recorded_at });
    }
  }

  let inRadius: { riderId: string; busy: number; distance: number } | null = null;
  for (const riderId of riderIds) {
    const pos = bestPosition.get(riderId);
    if (!pos) continue;
    const distance = haversineMeters(pickupLat, pickupLng, pos.lat, pos.lng);
    if (distance > AUTO_ASSIGN_RADIUS_M) continue;
    const busy = busyCount.get(riderId) ?? 0;
    if (!inRadius || busy < inRadius.busy || (busy === inRadius.busy && distance < inRadius.distance)) {
      inRadius = { riderId, busy, distance };
    }
  }
  if (inRadius) return inRadius.riderId;

  // Tier 2: no one is near the pickup point itself -- check whether a busy
  // rider's current in-progress delivery destination is near THIS order's
  // own delivery point instead (they're already heading that way).
  if (deliveryLat != null && deliveryLng != null) {
    let nearbyDestination: { riderId: string; busy: number; distance: number } | null = null;
    for (const riderId of riderIds) {
      const destinations = riderDestinations.get(riderId);
      if (!destinations || destinations.length === 0) continue;
      const distance = Math.min(
        ...destinations.map((d) => haversineMeters(deliveryLat, deliveryLng, d.lat, d.lng))
      );
      if (distance > AUTO_ASSIGN_DESTINATION_RADIUS_M) continue;
      const busy = busyCount.get(riderId) ?? 0;
      if (
        !nearbyDestination ||
        busy < nearbyDestination.busy ||
        (busy === nearbyDestination.busy && distance < nearbyDestination.distance)
      ) {
        nearbyDestination = { riderId, busy, distance };
      }
    }
    if (nearbyDestination) return nearbyDestination.riderId;
  }

  // Tier 3: no positional evidence points to any particular rider -- prefer
  // a genuinely idle one (blind pick; idle riders report no position).
  const idleRiderId = riderIds.find((riderId) => (busyCount.get(riderId) ?? 0) === 0);
  if (idleRiderId) return idleRiderId;

  // Tier 4: everyone is busy and no destination match was found -- fall
  // back to whichever active rider is least busy overall, regardless of
  // location.
  let leastBusy: { riderId: string; busy: number } | null = null;
  for (const riderId of riderIds) {
    const busy = busyCount.get(riderId) ?? 0;
    if (!leastBusy || busy < leastBusy.busy) leastBusy = { riderId, busy };
  }
  return leastBusy ? leastBusy.riderId : null;
}

export type AutoAssignOutcome = { riderId: string; riderName: string; riderPhone: string };

// Orchestrates auto-assignment for a freshly-created order: checks the
// tenant's auto_assign_enabled flag and pickup location, finds a rider, and
// performs the same tracking-token/PIN/customer-link issuance a manual ops
// assignment would. A no-op (order stays pending) if auto-assign is off, no
// pickup location is configured, or no active rider is found. `pickup`
// overrides the tenant's default_pickup_lat/lng -- used by the inbound API
// for multi-branch merchants who pass a per-order pickup point; ops/merchant
// dashboard callers omit it and always use the tenant's single default.
export async function runAutoAssignment(
  supabase: SupabaseClient,
  tenantId: string,
  orderId: string,
  pickup?: { lat: number; lng: number }
): Promise<AutoAssignOutcome | null> {
  const { data: tenant } = await supabase
    .from("tenants")
    .select("auto_assign_enabled, default_pickup_lat, default_pickup_lng")
    .eq("id", tenantId)
    .single();

  if (!tenant?.auto_assign_enabled) return null;
  const pickupLat = pickup?.lat ?? tenant.default_pickup_lat;
  const pickupLng = pickup?.lng ?? tenant.default_pickup_lng;
  if (pickupLat == null || pickupLng == null) return null;

  const { data: order } = await supabase
    .from("orders")
    .select("customer_name, customer_phone, delivery_lat, delivery_lng")
    .eq("id", orderId)
    .single();
  if (!order) return null;

  const riderId = await findRiderForAutoAssignment(
    supabase,
    tenantId,
    pickupLat,
    pickupLng,
    order.delivery_lat,
    order.delivery_lng
  );
  if (!riderId) return null;

  const { data: rider } = await supabase
    .from("riders")
    .select("name, phone")
    .eq("id", riderId)
    .single();
  if (!rider) return null;

  await performRiderAssignment(supabase, {
    orderId,
    riderId,
    riderPhone: rider.phone,
    customerPhone: order.customer_phone,
    customerName: order.customer_name,
    isReassignment: false,
  });

  return { riderId, riderName: rider.name, riderPhone: rider.phone };
}
