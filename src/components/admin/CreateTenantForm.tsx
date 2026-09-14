"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  MerchantButton,
  MerchantCard,
  MerchantInput,
  MerchantPageHeader,
} from "@/components/merchant/MerchantUi";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { Spinner } from "@/components/ui/Spinner";
import { apiFetch } from "@/lib/api/browserFetch";

export function CreateTenantForm() {
  const router = useRouter();
  const [merchantId, setMerchantId] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [generateApiKey, setGenerateApiKey] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdApiKey, setCreatedApiKey] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    setCreatedApiKey(null);

    try {
      const res = await apiFetch("/api/admin/tenants", {
        method: "POST",
        body: JSON.stringify({
          merchantId,
          name,
          password,
          contactEmail: contactEmail.trim() || null,
          generateApiKey,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.message ?? "Failed to create tenant.");
        return;
      }

      if (data.apiKey) setCreatedApiKey(data.apiKey);

      setTimeout(() => {
        router.push(`/admin/tenants/${data.tenantId}`);
        router.refresh();
      }, data.apiKey ? 4000 : 0);
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <MerchantPageHeader
        title="New tenant"
        subtitle="Creates a tenant row, merchant auth user, and optional inbound API key."
      />

      {error ? (
        <div className="mb-4">
          <StatusBanner tone="danger">{error}</StatusBanner>
        </div>
      ) : null}

      {createdApiKey ? (
        <div className="mb-4">
          <StatusBanner tone="success">
            <div>
              <p className="font-semibold">Tenant created. Save this API key — it won&apos;t be shown again:</p>
              <code className="mt-2 block break-all rounded bg-black/10 px-2 py-1 font-mono text-xs">
                {createdApiKey}
              </code>
            </div>
          </StatusBanner>
        </div>
      ) : null}

      <MerchantCard title="Tenant details">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Merchant ID
            </label>
            <MerchantInput
              placeholder="MERCHANT001"
              value={merchantId}
              onChange={(e) => setMerchantId(e.target.value.toUpperCase())}
            />
            <p className="mt-1 text-xs text-slate-500">
              Used at merchant login. Stored uppercase; login email is{" "}
              <span className="font-mono">id@merchants.internal</span>.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Display name
            </label>
            <MerchantInput
              placeholder="Acme Foods"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Contact email
            </label>
            <MerchantInput
              type="email"
              placeholder="ops@acme.com"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Initial password
            </label>
            <MerchantInput
              type="password"
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={generateApiKey}
              onChange={(e) => setGenerateApiKey(e.target.checked)}
              className="rounded border-slate-300"
            />
            Generate inbound API key on create
          </label>

          <div className="flex gap-2 pt-2">
            <MerchantButton onClick={submit} disabled={loading || !!createdApiKey}>
              {loading ? <Spinner className="h-4 w-4" /> : null}
              {loading ? "Creating…" : "Create tenant"}
            </MerchantButton>
            <MerchantButton variant="secondary" onClick={() => router.push("/admin/tenants")} disabled={loading}>
              Cancel
            </MerchantButton>
          </div>
        </div>
      </MerchantCard>
    </div>
  );
}
