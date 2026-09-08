"use client";

import { useRef, useState } from "react";
import { MerchantButton, MerchantCard, MerchantInput } from "@/components/merchant/MerchantUi";
import { TenantLogo } from "@/components/merchant/TenantLogo";
import { Spinner } from "@/components/ui/Spinner";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { apiFetch } from "@/lib/api/browserFetch";
import {
  DEFAULT_MERCHANT_ACCENT,
  DEFAULT_MERCHANT_PRIMARY,
  DEFAULT_MERCHANT_SECONDARY,
  isValidHexColor,
} from "@/lib/merchant/branding";

type BrandingState = {
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
};

export function BrandingSettings({
  tenantId,
  tenantName,
  initial,
}: {
  tenantId: string;
  tenantName: string;
  initial: BrandingState;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<BrandingState>(initial);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function setField<K extends keyof BrandingState>(key: K, value: BrandingState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await apiFetch("/api/merchant/branding/logo", { method: "POST", body });
      const data = await res.json();
      if (data.status !== "ok" || !data.logo_url) {
        setError(data.message ?? "Could not upload logo.");
        return;
      }
      setField("logoUrl", data.logo_url);
      setSaved(true);
      window.location.reload();
    } catch {
      setError("Could not upload logo. Check your connection and try again.");
    } finally {
      setUploading(false);
    }
  }

  async function removeLogo() {
    setRemoving(true);
    setError(null);
    try {
      const res = await apiFetch("/api/merchant/branding/logo", { method: "DELETE" });
      const data = await res.json();
      if (data.status !== "ok") {
        setError(data.message ?? "Could not remove logo.");
        return;
      }
      setField("logoUrl", "");
      window.location.reload();
    } catch {
      setError("Could not remove logo.");
    } finally {
      setRemoving(false);
    }
  }

  async function save() {
    setError(null);
    const colors = [form.primaryColor, form.secondaryColor, form.accentColor];
    if (colors.some((c) => !isValidHexColor(c))) {
      setError("Colors must be valid hex codes like #1e3a5f.");
      return;
    }

    setSaving(true);
    try {
      const res = await apiFetch("/api/merchant/branding", {
        method: "POST",
        body: JSON.stringify({
          primaryColor: form.primaryColor,
          secondaryColor: form.secondaryColor,
          accentColor: form.accentColor,
        }),
      });
      const data = await res.json();
      if (data.status !== "ok") {
        setError(data.message ?? "Could not save branding.");
        return;
      }

      setSaved(true);
      window.location.reload();
    } finally {
      setSaving(false);
    }
  }

  const hasLogo = Boolean(form.logoUrl.trim());
  const busy = saving || uploading || removing;

  return (
    <MerchantCard
      title="Brand appearance"
      subtitle="Logo and colors on your dashboard, customer tracking links, and the rider app."
    >

      {error ? (
        <div className="mb-4">
          <StatusBanner tone="danger">{error}</StatusBanner>
        </div>
      ) : null}
      {saved ? (
        <div className="mb-4">
          <StatusBanner tone="success">Branding saved.</StatusBanner>
        </div>
      ) : null}

      <div
        className="mb-5 flex items-center gap-4 rounded-xl border border-white/10 p-4"
        style={{ backgroundColor: form.primaryColor }}
      >
        <TenantLogo
          name={tenantName}
          logoUrl={form.logoUrl.trim() || null}
          size={48}
          accentColor={form.secondaryColor}
        />
        <div>
          <p className="font-semibold text-white">{tenantName}</p>
          <p className="text-xs text-white/70">Live preview</p>
        </div>
        <div className="ml-auto h-8 w-16 rounded-md" style={{ backgroundColor: form.secondaryColor }} />
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Logo
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={onFileSelected}
          />
          <div className="flex flex-wrap gap-2">
            <MerchantButton
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading && <Spinner className="h-4 w-4" />}
              {uploading ? "Uploading…" : hasLogo ? "Replace logo" : "Upload PNG"}
            </MerchantButton>
            {hasLogo ? (
              <MerchantButton type="button" variant="ghost" disabled={busy} onClick={removeLogo}>
                {removing && <Spinner className="h-4 w-4" />}
                {removing ? "Removing…" : "Remove logo"}
              </MerchantButton>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-slate-400">PNG, JPEG, or WebP — max 2 MB. Transparent PNG recommended.</p>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Or logo URL
          </label>
          <MerchantInput
            placeholder="https://example.com/logo.png"
            value={form.logoUrl}
            onChange={(e) => setField("logoUrl", e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-400">Optional if you host the logo elsewhere.</p>
        </div>

        <ColorField
          label="Primary color"
          hint="Header and main brand background"
          value={form.primaryColor}
          fallback={DEFAULT_MERCHANT_PRIMARY}
          onChange={(v) => setField("primaryColor", v)}
        />
        <ColorField
          label="Secondary color"
          hint="Accents, active nav, highlights"
          value={form.secondaryColor}
          fallback={DEFAULT_MERCHANT_SECONDARY}
          onChange={(v) => setField("secondaryColor", v)}
        />
        <ColorField
          label="Accent color"
          hint="Alerts and emphasis (optional)"
          value={form.accentColor}
          fallback={DEFAULT_MERCHANT_ACCENT}
          onChange={(v) => setField("accentColor", v)}
        />
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <MerchantButton onClick={save} disabled={busy}>
          {saving && <Spinner className="h-4 w-4" />}
          {saving ? "Saving…" : "Save colors"}
        </MerchantButton>
        <MerchantButton
          variant="secondary"
          disabled={busy}
          onClick={() =>
            setForm({
              logoUrl: initial.logoUrl,
              primaryColor: DEFAULT_MERCHANT_PRIMARY,
              secondaryColor: DEFAULT_MERCHANT_SECONDARY,
              accentColor: DEFAULT_MERCHANT_ACCENT,
            })
          }
        >
          Reset to default
        </MerchantButton>
      </div>
    </MerchantCard>
  );
}

function ColorField({
  label,
  hint,
  value,
  fallback,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  fallback: string;
  onChange: (value: string) => void;
}) {
  const safe = isValidHexColor(value) ? value : fallback;
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={safe}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 cursor-pointer rounded border border-white/10 bg-transparent"
        />
        <MerchantInput
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={fallback}
          className="font-mono"
        />
      </div>
      <p className="mt-1 text-xs text-slate-400">{hint}</p>
    </div>
  );
}
