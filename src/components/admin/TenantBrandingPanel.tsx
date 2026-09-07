"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MerchantButton, MerchantCard, MerchantInput } from "@/components/merchant/MerchantUi";
import { TenantLogo } from "@/components/merchant/TenantLogo";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { Spinner } from "@/components/ui/Spinner";
import type { TenantRow } from "@/lib/admin/tenantTypes";

export function TenantBrandingPanel({ tenant: initial }: { tenant: TenantRow }) {
  const router = useRouter();
  const [tenant, setTenant] = useState(initial);
  const [primaryColor, setPrimaryColor] = useState(tenant.primary_color);
  const [secondaryColor, setSecondaryColor] = useState(tenant.secondary_color);
  const [accentColor, setAccentColor] = useState(tenant.accent_color);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primaryColor, secondaryColor, accentColor }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ tone: "danger", text: data.message ?? "Save failed." });
        return;
      }
      setTenant(data.tenant);
      setMessage({ tone: "success", text: "Branding colors updated." });
      router.refresh();
    } catch {
      setMessage({ tone: "danger", text: "Couldn't reach the server." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {message ? (
        <div className="mb-4">
          <StatusBanner tone={message.tone}>{message.text}</StatusBanner>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <MerchantCard title="Brand colors">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(
                [
                  ["Primary", primaryColor, setPrimaryColor],
                  ["Secondary", secondaryColor, setSecondaryColor],
                  ["Accent", accentColor, setAccentColor],
                ] as const
              ).map(([label, value, setter]) => (
                <div key={label}>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {label}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={value}
                      onChange={(e) => setter(e.target.value)}
                      className="h-10 w-10 cursor-pointer rounded-lg border border-slate-200"
                    />
                    <MerchantInput
                      value={value}
                      onChange={(e) => setter(e.target.value)}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
              ))}
            </div>
            <MerchantButton onClick={save} disabled={saving}>
              {saving ? <Spinner className="h-4 w-4" /> : null}
              {saving ? "Saving…" : "Save colors"}
            </MerchantButton>
          </div>
        </MerchantCard>

        <MerchantCard title="Logo" subtitle="Upload is managed from the merchant portal.">
          <div className="flex items-center gap-4">
            <TenantLogo
              name={tenant.name}
              logoUrl={tenant.logo_url}
              size={64}
              accentColor={secondaryColor}
            />
            <div className="min-w-0 text-sm text-slate-600">
              {tenant.logo_url ? (
                <p className="truncate font-mono text-xs text-slate-500">{tenant.logo_url}</p>
              ) : (
                <p>No logo uploaded yet.</p>
              )}
              <p className="mt-2 text-xs text-slate-400">
                Merchants upload logos under Settings → Brand appearance.
              </p>
            </div>
          </div>
        </MerchantCard>
      </div>
    </div>
  );
}
