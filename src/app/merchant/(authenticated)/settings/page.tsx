import { requireMerchantUser } from "@/lib/merchant/authGuard";
import { serverApi } from "@/lib/api/server";
import { AutoAssignSettings } from "@/components/merchant/AutoAssignSettings";
import { ApiKeySettings } from "@/components/merchant/ApiKeySettings";
import { BrandingSettings } from "@/components/merchant/BrandingSettings";
import { MerchantPageHeader } from "@/components/merchant/MerchantUi";
import { MerchantSettingsSidebar } from "@/components/merchant/MerchantSettingsSidebar";

export default async function MerchantSettingsPage() {
  const merchant = await requireMerchantUser();
  const api = await serverApi("/merchant/login");
  const { data } = await api.get<{
    status: string;
    settings: {
      id: string;
      auto_assign_enabled: boolean;
      default_pickup_address: string | null;
      default_pickup_lat: number | null;
      default_pickup_lng: number | null;
      api_key_prefix: string | null;
      logo_url: string | null;
      primary_color: string;
      secondary_color: string;
      accent_color: string;
    };
  }>("/api/merchant/settings");

  const tenant = data.settings;

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
                primaryColor: tenant?.primary_color ?? merchant.branding.primaryColor,
                secondaryColor: tenant?.secondary_color ?? merchant.branding.secondaryColor,
                accentColor: tenant?.accent_color ?? merchant.branding.accentColor,
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
