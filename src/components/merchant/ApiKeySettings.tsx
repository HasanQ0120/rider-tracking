"use client";

import { useState } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { MerchantButton, MerchantCard } from "@/components/merchant/MerchantUi";

export function ApiKeySettings({ initialPrefix }: { initialPrefix: string | null }) {
  const [prefix, setPrefix] = useState(initialPrefix);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState<"generate" | "revoke" | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    setConfirmOpen(null);
    try {
      const res = await fetch("/api/merchant/api-key", { method: "POST" });
      const data = await res.json();
      if (data.status !== "ok") {
        setError("Failed to generate an API key.");
        return;
      }
      setPrefix(data.prefix);
      setRevealedKey(data.apiKey);
      setCopied(false);
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    setBusy(true);
    setError(null);
    setConfirmOpen(null);
    try {
      const res = await fetch("/api/merchant/api-key", { method: "DELETE" });
      const data = await res.json();
      if (data.status !== "ok") {
        setError("Failed to revoke the API key.");
        return;
      }
      setPrefix(null);
      setRevealedKey(null);
    } finally {
      setBusy(false);
    }
  }

  async function copyKey() {
    const key = revealedKey ?? prefix;
    if (!key) return;
    await navigator.clipboard.writeText(revealedKey ?? `${key}…`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const endpoint =
    typeof window !== "undefined" ? `${window.location.origin}/api/v1/orders` : "/api/v1/orders";

  return (
    <MerchantCard
      title="API access"
      subtitle="Push orders from your site or POS into this dashboard."
    >
      {error && (
        <div className="mb-4">
          <StatusBanner tone="danger">{error}</StatusBanner>
        </div>
      )}

      {revealedKey && (
        <div className="mb-4 animate-fade-in rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="mb-2 text-xs font-semibold text-amber-800">
            Copy this now — you won&apos;t be able to see it again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-lg bg-white px-3 py-2 text-xs text-slate-800">
              {revealedKey}
            </code>
            <MerchantButton variant="secondary" onClick={copyKey}>
              {copied ? "Copied!" : "Copy"}
            </MerchantButton>
          </div>
        </div>
      )}

      {prefix ? (
        <div
          className="mb-4 rounded-xl p-4"
          style={{ backgroundColor: "var(--merchant-primary)" }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Active key</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-sm text-white">{prefix}…</p>
            <div className="flex gap-2">
              <MerchantButton variant="secondary" size="sm" onClick={copyKey}>
                {copied ? "Copied!" : "Copy"}
              </MerchantButton>
              <MerchantButton
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => setConfirmOpen("generate")}
              >
                Regenerate
              </MerchantButton>
            </div>
          </div>
        </div>
      ) : (
        <p className="mb-4 text-sm text-slate-400">No API key generated yet.</p>
      )}

      {!prefix ? (
        <MerchantButton disabled={busy} onClick={() => setConfirmOpen("generate")}>
          {busy && <Spinner className="h-4 w-4" />}
          Generate API key
        </MerchantButton>
      ) : (
        <MerchantButton variant="ghost" disabled={busy} onClick={() => setConfirmOpen("revoke")}>
          Revoke key
        </MerchantButton>
      )}

      <div className="mt-5 rounded-xl bg-slate-50 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Example request
        </p>
        <pre className="overflow-x-auto text-xs leading-relaxed text-slate-700">
          {`POST ${endpoint}
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "customer_name": "Fatima Zahra",
  "customer_phone": "03001234567",
  "delivery_address": "House 12, Block 13-D2, Gulshan-e-Iqbal, Karachi"
}`}
        </pre>
      </div>

      <ConfirmDialog
        open={confirmOpen === "generate"}
        title={prefix ? "Regenerate API Key?" : "Generate API Key?"}
        message={
          prefix
            ? "Your current key will stop working immediately. Any integration using it will need to be updated with the new key."
            : "A new key will be created for your integration to use."
        }
        confirmLabel={prefix ? "Regenerate" : "Generate"}
        confirming={busy}
        onConfirm={generate}
        onCancel={() => setConfirmOpen(null)}
      />
      <ConfirmDialog
        open={confirmOpen === "revoke"}
        title="Revoke API Key?"
        message="Your integration will stop being able to create orders through the API until you generate a new key."
        confirmLabel="Revoke"
        confirming={busy}
        onConfirm={revoke}
        onCancel={() => setConfirmOpen(null)}
      />
    </MerchantCard>
  );
}
