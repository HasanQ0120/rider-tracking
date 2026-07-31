import { requireMerchantUser } from "@/lib/merchant/authGuard";
import { createAuthServerClient } from "@/lib/supabase/serverAuth";
import { AutoAssignSettings } from "@/components/merchant/AutoAssignSettings";
import { ApiKeySettings } from "@/components/merchant/ApiKeySettings";

export default async function MerchantSettingsPage() {
  const merchant = await requireMerchantUser();
  const supabase = await createAuthServerClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select(
      "id, auto_assign_enabled, default_pickup_address, default_pickup_lat, default_pickup_lng, api_key_prefix"
    )
    .eq("id", merchant.tenantId)
    .single();

  return (
    <div className="mx-auto max-w-md animate-slide-up space-y-6">
      <h1 className="text-2xl font-semibold text-white">Settings</h1>
      <AutoAssignSettings
        tenantId={merchant.tenantId}
        initialAutoAssignEnabled={tenant?.auto_assign_enabled ?? false}
        initialPickupAddress={tenant?.default_pickup_address ?? null}
        initialPickupLat={tenant?.default_pickup_lat ?? null}
        initialPickupLng={tenant?.default_pickup_lng ?? null}
      />
      <ApiKeySettings initialPrefix={tenant?.api_key_prefix ?? null} />
    </div>
  );
}
