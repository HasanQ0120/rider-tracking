"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  MerchantButton,
  MerchantCard,
  MerchantInput,
  MerchantPageHeader,
} from "@/components/merchant/MerchantUi";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { Spinner } from "@/components/ui/Spinner";
import { merchantIdToEmail } from "@/lib/admin/merchantEmail";
import { tenantStatusLabel, type TenantRow } from "@/lib/admin/tenantTypes";

type TenantDetail = TenantRow;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-900">{children}</dd>
    </div>
  );
}

export function TenantDetailPanel({ tenant: initial }: { tenant: TenantDetail }) {
  const router = useRouter();
  const [tenant, setTenant] = useState(initial);
  const [name, setName] = useState(tenant.name);
  const [contactEmail, setContactEmail] = useState(tenant.contact_email ?? "");
  const [webhookUrl, setWebhookUrl] = useState(tenant.webhook_url ?? "");
  const [primaryColor, setPrimaryColor] = useState(tenant.primary_color);
  const [secondaryColor, setSecondaryColor] = useState(tenant.secondary_color);
  const [accentColor, setAccentColor] = useState(tenant.accent_color);
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [apiKeyLoading, setApiKeyLoading] = useState(false);

  async function saveProfile() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          contactEmail: contactEmail.trim() || null,
          webhookUrl: webhookUrl.trim() || null,
          primaryColor,
          secondaryColor,
          accentColor,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ tone: "danger", text: data.message ?? "Save failed." });
        return;
      }
      setTenant(data.tenant);
      setMessage({ tone: "success", text: "Tenant updated." });
      router.refresh();
    } catch {
      setMessage({ tone: "danger", text: "Couldn't reach the server." });
    } finally {
      setSaving(false);
    }
  }

  async function toggleSuspended() {
    const suspended = !tenant.suspended_at;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suspended }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ tone: "danger", text: data.message ?? "Update failed." });
        return;
      }
      setTenant(data.tenant);
      setMessage({ tone: "success", text: suspended ? "Tenant suspended." : "Tenant reactivated." });
      router.refresh();
    } catch {
      setMessage({ tone: "danger", text: "Couldn't reach the server." });
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword() {
    if (!newPassword) return;
    setResettingPassword(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ tone: "danger", text: data.message ?? "Password reset failed." });
        return;
      }
      setNewPassword("");
      setMessage({ tone: "success", text: "Merchant password reset." });
    } catch {
      setMessage({ tone: "danger", text: "Couldn't reach the server." });
    } finally {
      setResettingPassword(false);
    }
  }

  async function generateApiKey() {
    setApiKeyLoading(true);
    setMessage(null);
    setNewApiKey(null);
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.id}/api-key`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ tone: "danger", text: data.message ?? "API key generation failed." });
        return;
      }
      setNewApiKey(data.apiKey);
      setTenant((t) => ({ ...t, api_key_prefix: data.prefix }));
      setMessage({ tone: "success", text: "New API key generated — copy it now." });
      router.refresh();
    } catch {
      setMessage({ tone: "danger", text: "Couldn't reach the server." });
    } finally {
      setApiKeyLoading(false);
    }
  }

  async function revokeApiKey() {
    if (!confirm("Revoke this tenant's API key? Inbound order creation will stop until a new key is issued.")) {
      return;
    }
    setApiKeyLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.id}/api-key`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ tone: "danger", text: data.message ?? "Revoke failed." });
        return;
      }
      setTenant((t) => ({ ...t, api_key_prefix: null }));
      setMessage({ tone: "success", text: "API key revoked." });
      router.refresh();
    } catch {
      setMessage({ tone: "danger", text: "Couldn't reach the server." });
    } finally {
      setApiKeyLoading(false);
    }
  }

  const status = tenantStatusLabel(tenant);

  return (
    <div>
      <MerchantPageHeader
        title={tenant.name}
        subtitle={
          <span>
            <span className="font-mono">{tenant.merchant_id}</span>
            <span className="mx-2 text-slate-300">·</span>
            <span>{status}</span>
          </span>
        }
        actions={
          <Link href="/admin">
            <MerchantButton variant="secondary">Back to list</MerchantButton>
          </Link>
        }
      />

      {message ? (
        <div className="mb-4">
          <StatusBanner tone={message.tone}>{message.text}</StatusBanner>
        </div>
      ) : null}

      {newApiKey ? (
        <div className="mb-4">
          <StatusBanner tone="success">
            <div>
              <p className="font-semibold">New API key (shown once):</p>
              <code className="mt-2 block break-all rounded bg-black/10 px-2 py-1 font-mono text-xs">
                {newApiKey}
              </code>
            </div>
          </StatusBanner>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <MerchantCard title="Profile">
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Display name
              </label>
              <MerchantInput value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Contact email
              </label>
              <MerchantInput
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Webhook URL
              </label>
              <MerchantInput
                placeholder="https://…"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
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
            <MerchantButton onClick={saveProfile} disabled={saving}>
              {saving ? <Spinner className="h-4 w-4" /> : null}
              {saving ? "Saving…" : "Save changes"}
            </MerchantButton>
          </div>
        </MerchantCard>

        <div className="space-y-6">
          <MerchantCard title="Account">
            <dl className="grid gap-4 sm:grid-cols-2">
              <Field label="Login email">
                <span className="font-mono text-xs">{merchantIdToEmail(tenant.merchant_id)}</span>
              </Field>
              <Field label="Auth linked">{tenant.auth_user_id ? "Yes" : "No"}</Field>
              <Field label="Created">{new Date(tenant.created_at).toLocaleString()}</Field>
              <Field label="Auto-assign">{tenant.auto_assign_enabled ? "Enabled" : "Disabled"}</Field>
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              <MerchantButton
                variant={tenant.suspended_at ? "primary" : "danger"}
                onClick={toggleSuspended}
                disabled={saving}
              >
                {tenant.suspended_at ? "Reactivate tenant" : "Suspend tenant"}
              </MerchantButton>
              <Link href={`/merchant/login`} target="_blank">
                <MerchantButton variant="secondary">Merchant login ↗</MerchantButton>
              </Link>
            </div>
          </MerchantCard>

          <MerchantCard title="Reset password">
            <div className="flex flex-col gap-3 sm:flex-row">
              <MerchantInput
                type="password"
                placeholder="New password (min. 8 chars)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <MerchantButton onClick={resetPassword} disabled={resettingPassword || !newPassword}>
                {resettingPassword ? <Spinner className="h-4 w-4" /> : null}
                Reset
              </MerchantButton>
            </div>
          </MerchantCard>

          <MerchantCard title="Inbound API key">
            <p className="mb-3 text-sm text-slate-600">
              {tenant.api_key_prefix
                ? `Active key prefix: ${tenant.api_key_prefix}…`
                : "No API key issued — merchant cannot create orders via API."}
            </p>
            <div className="flex flex-wrap gap-2">
              <MerchantButton onClick={generateApiKey} disabled={apiKeyLoading}>
                {apiKeyLoading ? <Spinner className="h-4 w-4" /> : null}
                {tenant.api_key_prefix ? "Rotate key" : "Generate key"}
              </MerchantButton>
              {tenant.api_key_prefix ? (
                <MerchantButton variant="danger" onClick={revokeApiKey} disabled={apiKeyLoading}>
                  Revoke
                </MerchantButton>
              ) : null}
            </div>
          </MerchantCard>
        </div>
      </div>
    </div>
  );
}
