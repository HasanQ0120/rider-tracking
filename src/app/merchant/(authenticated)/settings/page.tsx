import { requireMerchantUser } from "@/lib/merchant/authGuard";
import { createAuthServerClient } from "@/lib/supabase/serverAuth";
import { AutoAssignSettings } from "@/components/merchant/AutoAssignSettings";
import { ApiKeySettings } from "@/components/merchant/ApiKeySettings";
import { BrandingSettings } from "@/components/merchant/BrandingSettings";
import { MerchantPageHeader } from "@/components/merchant/MerchantUi";
import { MerchantSettingsSidebar } from "@/components/merchant/MerchantSettingsSidebar";

export default async function MerchantSettingsPage() {
  const merchant = await requireMerchantUser();
  const supabase = await createAuthServerClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select(
      "id, auto_assign_enabled, default_pickup_address, default_pickup_lat, default_pickup_lng, api_key_prefix, logo_url, primary_color, secondary_color, accent_color"
    )
    .eq("id", merchant.tenantId)
    .single();

  return (
    <>
      <MerchantPageHeader title="Settings" />

      <div className="grid gap-6 lg:grid-cols-[1fr_240px]">
        <div className="space-y-6">
          <div id="brand-appearance">
            <BrandingSettings
              tenantId={merchant.tenantId}
              tenantName={merchant.name}
              initial={{
                logoUrl: tenant?.logo_url ?? "",
                primaryColor: merchant.branding.primaryColor,
                secondaryColor: merchant.branding.secondaryColor,
                accentColor: merchant.branding.accentColor,
              }}
            />
          </div>
          <AutoAssignSettings
            tenantId={merchant.tenantId}
            initialAutoAssignEnabled={tenant?.auto_assign_enabled ?? false}
            initialPickupAddress={tenant?.default_pickup_address ?? null}
            initialPickupLat={tenant?.default_pickup_lat ?? null}
            initialPickupLng={tenant?.default_pickup_lng ?? null}
          />
          <div id="api-access">
            <ApiKeySettings initialPrefix={tenant?.api_key_prefix ?? null} />
          </div>
        </div>

        <MerchantSettingsSidebar />
      </div>
    </>
  );
}
