import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type RiderTokenRow = {
  id: string;
  token: string;
  order_id: string;
  rider_id: string | null;
  active: boolean;
  expires_at: string;
  pin_fail_count: number;
  pin_locked_until: string | null;
};

// Server-clock-only validity check -- never trusts a client-reported time,
// so a phone's clock can't be used to make an expired token look valid.
export async function loadActiveRiderToken(
  supabase: SupabaseClient,
  token: string
): Promise<RiderTokenRow | null> {
  const { data, error } = await supabase
    .from("tracking_tokens")
    .select(
      "id, token, order_id, rider_id, active, expires_at, pin_fail_count, pin_locked_until"
    )
    .eq("token", token)
    .eq("type", "rider")
    .eq("active", true)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error || !data) return null;
  return data as RiderTokenRow;
}

export async function getDeviceLock(supabase: SupabaseClient, riderTokenId: string) {
  const { data } = await supabase
    .from("device_locks")
    .select("device_key")
    .eq("rider_token_id", riderTokenId)
    .maybeSingle();
  return data?.device_key ?? null;
}

// True only when this device holds the current, non-superseded session --
// the enforcement point for "only the most-recently-active tab keeps
// sending; older tabs are told to stop."
export async function isActiveSession(
  supabase: SupabaseClient,
  riderTokenId: string,
  sessionId: string
) {
  const { data } = await supabase
    .from("tracking_sessions")
    .select("session_id")
    .eq("rider_token_id", riderTokenId)
    .eq("is_active", true)
    .maybeSingle();
  return data?.session_id === sessionId;
}
