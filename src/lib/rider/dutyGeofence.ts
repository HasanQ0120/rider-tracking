import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { haversineMeters } from "@/lib/geo";
import { DEFAULT_DUTY_CHECKIN_RADIUS_M } from "@/lib/config";

export type GeofenceResult =
  | { ok: true }
  | { ok: false; distanceMeters: number; radiusMeters: number };

// Gates the check-in moment only (see callers) -- verifies a rider's
// reported position is actually near the merchant's pickup point before
// letting them go on duty, so they can't falsely claim to be at the
// restaurant while at home and wrongly qualify for auto-assignment's
// least-busy fallback. Fails open (allows check-in) if the tenant hasn't
// configured a pickup location yet, matching runAutoAssignment's own
// no-op-without-pickup behavior rather than locking riders out entirely.
export async function checkDutyGeofence(
  supabase: SupabaseClient,
  tenantId: string,
  lat: number,
  lng: number
): Promise<GeofenceResult> {
  const { data: tenant } = await supabase
    .from("tenants")
    .select("default_pickup_lat, default_pickup_lng, duty_checkin_radius_m")
    .eq("id", tenantId)
    .single();

  if (!tenant || tenant.default_pickup_lat == null || tenant.default_pickup_lng == null) {
    return { ok: true };
  }

  const radiusMeters = tenant.duty_checkin_radius_m ?? DEFAULT_DUTY_CHECKIN_RADIUS_M;
  const distanceMeters = haversineMeters(
    tenant.default_pickup_lat,
    tenant.default_pickup_lng,
    lat,
    lng
  );

  if (distanceMeters > radiusMeters) {
    return { ok: false, distanceMeters: Math.round(distanceMeters), radiusMeters };
  }
  return { ok: true };
}
