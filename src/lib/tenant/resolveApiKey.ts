import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { verifyPin, apiKeyPrefix } from "@/lib/tokens";

export type ApiTenant = {
  id: string;
  merchantId: string;
  autoAssignEnabled: boolean;
  defaultPickupLat: number | null;
  defaultPickupLng: number | null;
};

// Resolves a raw inbound-API key to its tenant, or null if the key is
// missing, malformed, doesn't match any tenant's prefix, fails the bcrypt
// compare, or belongs to a deactivated tenant.
export async function resolveTenantByApiKey(
  supabase: SupabaseClient,
  rawKey: string | null
): Promise<ApiTenant | null> {
  if (!rawKey) return null;

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, merchant_id, api_key_hash, auto_assign_enabled, default_pickup_lat, default_pickup_lng, active")
    .eq("api_key_prefix", apiKeyPrefix(rawKey))
    .maybeSingle();

  if (!tenant || !tenant.active || !tenant.api_key_hash) return null;

  const valid = await verifyPin(rawKey, tenant.api_key_hash);
  if (!valid) return null;

  return {
    id: tenant.id,
    merchantId: tenant.merchant_id,
    autoAssignEnabled: tenant.auto_assign_enabled,
    defaultPickupLat: tenant.default_pickup_lat,
    defaultPickupLng: tenant.default_pickup_lng,
  };
}
