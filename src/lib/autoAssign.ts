import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { haversineMeters } from "@/lib/geo";
import { performRiderAssignment } from "@/lib/assignRider";
import { AUTO_ASSIGN_RADIUS_M, DUTY_LOCATION_STALE_TIMEOUT_S } from "@/lib/config";

const ACTIVE_STATUSES = ["assigned", "in_transit", "arrived"];

type Position = { lat: number; lng: number; recordedAt: string };

// Among a tenant's active riders, picks whichever is currently carrying
// fewest active parcels among those within AUTO_ASSIGN_RADIUS_M of the
// pickup point; if none are within radius, falls back to whichever active
// rider is least busy overall, any distance. Returns null if the tenant has
// no active riders (order is left pending, unassigned, exactly as today).
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

  const staleCutoff = new Date(Date.now() - DUTY_LOCATION_STALE_TIMEOUT_S * 1000).toISOString();

  const { data: dutyLocations } = await supabase
    .from("rider_duty_locations")
    .select("rider_id, lat, lng, recorded_at")
    .in("rider_id", riderIds)
    .gt("recorded_at", staleCutoff);

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
  // between rider_duty_locations and current_locations" rule.
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
    if (riderId) considerPosition(riderId, l.lat, l.lng, l.recorded_at);
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

  // No rider within radius (or no rider reporting a location at all) --
  // fall back to whichever active rider is least busy overall.
  let leastBusy: { riderId: string; busy: number } | null = null;
  for (const riderId of riderIds) {
    const busy = busyCount.get(riderId) ?? 0;
    if (!leastBusy || busy < leastBusy.busy) leastBusy = { riderId, busy };
  }
  return leastBusy ? leastBusy.riderId : null;
}

// Orchestrates auto-assignment for a freshly-created order: checks the
// tenant's auto_assign_enabled flag and pickup location, finds a rider, and
// performs the same tracking-token/PIN/customer-link issuance a manual ops
// assignment would. A no-op (order stays pending) if auto-assign is off, no
// pickup location is configured, or no active rider is found.
export async function runAutoAssignment(
  supabase: SupabaseClient,
  tenantId: string,
  orderId: string
): Promise<void> {
  const { data: tenant } = await supabase
    .from("tenants")
    .select("auto_assign_enabled, default_pickup_lat, default_pickup_lng")
    .eq("id", tenantId)
    .single();

  if (!tenant?.auto_assign_enabled) return;
  if (tenant.default_pickup_lat == null || tenant.default_pickup_lng == null) return;

  const riderId = await findRiderForAutoAssignment(
    supabase,
    tenantId,
    tenant.default_pickup_lat,
    tenant.default_pickup_lng
  );
  if (!riderId) return;

  const { data: rider } = await supabase.from("riders").select("phone").eq("id", riderId).single();
  const { data: order } = await supabase
    .from("orders")
    .select("customer_phone")
    .eq("id", orderId)
    .single();
  if (!rider || !order) return;

  await performRiderAssignment(supabase, {
    orderId,
    riderId,
    riderPhone: rider.phone,
    customerPhone: order.customer_phone,
    isReassignment: false,
  });
}
