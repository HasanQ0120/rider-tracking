import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type DutyRiderRow = {
  id: string;
  name: string;
  active: boolean;
};

export async function loadRiderByDutyToken(
  supabase: SupabaseClient,
  dutyToken: string
): Promise<DutyRiderRow | null> {
  const { data, error } = await supabase
    .from("riders")
    .select("id, name, active")
    .eq("duty_token", dutyToken)
    .maybeSingle();
  if (error || !data) return null;
  return data as DutyRiderRow;
}
