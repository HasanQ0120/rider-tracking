import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { haversineMeters } from "@/lib/geo";
import { performRiderAssignment } from "@/lib/assignRider";
import { AUTO_ASSIGN_RADIUS_M } from "@/lib/config";

const ACTIVE_STATUSES = ["assigned", "in_transit", "arrived"];

type Position = { lat: number; lng: number; recordedAt: string };

// Every active rider is a candidate -- there's no separate "on duty" state
// gating eligibility (removed entirely; riders are available by default).
// Picks whichever active rider is carrying fewest active parcels among
// those within AUTO_ASSIGN_RADIUS_M of the pickup point, using each
// rider's freshest current_locations reading from their own in-progress
// orders as "where they are" (the only location source there is now, since
// idle riders have no separate ping to report one). No staleness cutoff on
// that reading -- deliberately "whatever's available," not a second
// stale-session problem. If nobody has a usable reading within radius,
// falls back to whichever active rider is least busy overall, any
// distance. Returns null only if the tenant has no active riders at all.
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

  const { data: activeOrders } = await supabase
    .from("orders")
    .select("id, assigned_rider_id")
    .eq("tenant_id", tenantId)
    .in("status", ACTIVE_STATUSES)
    .in("assigned_rider_id", riderIds);

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

  // No rider with a usable location is within radius -- fall back to
  // whichever active rider is least busy overall, regardless of location.
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

  const riderId = await findRiderForAutoAssignment(supabase, tenantId, pickupLat, pickupLng);
  if (!riderId) return null;

  const { data: rider } = await supabase
    .from("riders")
    .select("name, phone")
    .eq("id", riderId)
    .single();
  const { data: order } = await supabase
    .from("orders")
    .select("customer_name, customer_phone")
    .eq("id", orderId)
    .single();
  if (!rider || !order) return null;

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
