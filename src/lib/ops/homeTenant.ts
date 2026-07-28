import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { OPS_HOME_MERCHANT_ID } from "@/lib/config";

// Resolves the one tenant ops-initiated writes (new order, new rider) go
// into. See OPS_HOME_MERCHANT_ID for why this exists instead of a real
// tenant-switcher.
export async function getOpsHomeTenantId(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase
    .from("tenants")
    .select("id")
    .eq("merchant_id", OPS_HOME_MERCHANT_ID)
    .single();
  if (error || !data) {
    throw new Error(`Ops home tenant '${OPS_HOME_MERCHANT_ID}' not found`);
  }
  return data.id;
}
