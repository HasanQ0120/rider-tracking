import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { haversineMeters } from "@/lib/geo";
import { performRiderAssignment } from "@/lib/assignRider";
import { AUTO_ASSIGN_RADIUS_M, DUTY_LOCATION_STALE_TIMEOUT_S } from "@/lib/config";

const ACTIVE_STATUSES = ["assigned", "in_transit", "arrived"];

type Position = { lat: number; lng: number; recordedAt: string };

// Among a tenant's on-duty riders, picks whichever is currently carrying
// fewest active parcels among those within AUTO_ASSIGN_RADIUS_M of the
// pickup point; if none are within radius, falls back to whichever on-duty
// rider is least busy overall, any distance. Returns null if the tenant has
// no active riders, or none of them are currently on duty (order is left
// pending, unassigned, exactly as today) -- being "active" in the riders
// table is not enough on its own; a rider must have actually checked in via
// their duty link to be a candidate at all, in either pass.
export async function findRiderForAutoAssignment(
  supabase: SupabaseClient,
  tenantId: string,
  pickupLat: number,
  pickupLng: number
): Promise<string | null> {
  const { data: riders } = await supabase
    .from("riders")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("active", true);
  if (!riders || riders.length === 0) return null;
  const riderIds = riders.map((r) => r.id);

  const staleCutoff = new Date(Date.now() - DUTY_LOCATION_STALE_TIMEOUT_S * 1000).toISOString();

  // This is the on-duty set, not just a position lookup -- checked first so
  // a tenant with active riders but nobody actually on duty short-circuits
  // before the busy-count/live-location queries below even run.
  const { data: dutyLocations } = await supabase
    .from("rider_duty_locations")
    .select("rider_id, lat, lng, recorded_at")
    .in("rider_id", riderIds)
    .gt("recorded_at", staleCutoff);

  const onDutyRiderIds = new Set((dutyLocations ?? []).map((d) => d.rider_id));
  if (onDutyRiderIds.size === 0) return null;

  const { data: activeOrders } = await supabase
    .from("orders")
    .select("id, assigned_rider_id")
    .eq("tenant_id", tenantId)
    .in("status", ACTIVE_STATUSES)
    .in("assigned_rider_id", [...onDutyRiderIds]);

  const busyCount = new Map<string, number>();
  const orderIdToRider = new Map<string, string>();
  for (const o of activeOrders ?? []) {
    if (!o.assigned_rider_id) continue;
    busyCount.set(o.assigned_rider_id, (busyCount.get(o.assigned_rider_id) ?? 0) + 1);
    orderIdToRider.set(o.id, o.assigned_rider_id);
  }

  const orderIds = [...orderIdToRider.keys()];
  const { data: liveLocations } = orderIds.length
    ? await supabase
        .from("current_locations")
        .select("order_id, lat, lng, recorded_at")
        .in("order_id", orderIds)
        .gt("recorded_at", staleCutoff)
    : { data: [] as { order_id: string; lat: number; lng: number; recorded_at: string }[] };

  // A rider can have a fresh reading from more than one source (on-duty
  // ping, or a currently in-progress order's live tracking) -- take
  // whichever is freshest, matching the plan's "whichever is freshest
  // between rider_duty_locations and current_locations" rule. This is only
  // ever used to refine WHERE an on-duty rider is, never to make an
  // off-duty rider eligible.
  const bestPosition = new Map<string, Position>();
  function considerPosition(riderId: string, lat: number, lng: number, recordedAt: string) {
    const existing = bestPosition.get(riderId);
    if (!existing || recordedAt > existing.recordedAt) {
      bestPosition.set(riderId, { lat, lng, recordedAt });
    }
  }
  for (const d of dutyLocations ?? []) considerPosition(d.rider_id, d.lat, d.lng, d.recorded_at);
  for (const l of liveLocations ?? []) {
    const riderId = orderIdToRider.get(l.order_id);
    if (riderId && onDutyRiderIds.has(riderId)) considerPosition(riderId, l.lat, l.lng, l.recorded_at);
  }

  let inRadius: { riderId: string; busy: number; distance: number } | null = null;
  for (const riderId of onDutyRiderIds) {
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

  // No on-duty rider within radius -- fall back to whichever on-duty rider
  // is least busy overall. Off-duty riders are never candidates here,
  // regardless of how idle they look on paper.
  let leastBusy: { riderId: string; busy: number } | null = null;
  for (const riderId of onDutyRiderIds) {
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

  const riderId = await findRiderForAutoAssignment(supabase, tenantId, pickupLat, pickupLng);
  if (!riderId) return null;

  const { data: rider } = await supabase
    .from("riders")
    .select("name, phone")
    .eq("id", riderId)
    .single();
  const { data: order } = await supabase
    .from("orders")
    .select("customer_phone")
    .eq("id", orderId)
    .single();
  if (!rider || !order) return null;

  await performRiderAssignment(supabase, {
    orderId,
    riderId,
    riderPhone: rider.phone,
    customerPhone: order.customer_phone,
    isReassignment: false,
  });

  return { riderId, riderName: rider.name, riderPhone: rider.phone };
}
