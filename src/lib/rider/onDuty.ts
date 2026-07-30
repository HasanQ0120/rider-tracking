import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DUTY_LOCATION_STALE_TIMEOUT_S } from "@/lib/config";

// A rider counts as "on duty" only while they have a fresh rider_duty_locations
// row -- i.e. they've actually checked in via their duty link (and passed the
// geofence check) recently enough to still be considered available. New
// riders have no row at all until they check in, so they're off duty by
// default with zero extra bookkeeping; a rider who closes their tab without
// tapping "Go Off Duty" naturally drops back out once their last ping goes
// stale.
export async function filterOnDutyRiderIds(
  supabase: SupabaseClient,
  riderIds: string[]
): Promise<Set<string>> {
  if (riderIds.length === 0) return new Set();
  const staleCutoff = new Date(Date.now() - DUTY_LOCATION_STALE_TIMEOUT_S * 1000).toISOString();
  const { data } = await supabase
    .from("rider_duty_locations")
    .select("rider_id")
    .in("rider_id", riderIds)
    .gt("recorded_at", staleCutoff);
  return new Set((data ?? []).map((d) => d.rider_id));
}
