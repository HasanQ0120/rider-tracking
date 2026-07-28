"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

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
    if (!revealedKey) return;
    await navigator.clipboard.writeText(revealedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const endpoint =
    typeof window !== "undefined" ? `${window.location.origin}/api/v1/orders` : "/api/v1/orders";

  return (
    <Card title="API Access">
      {error && (
        <div className="mb-4">
          <StatusBanner tone="danger">{error}</StatusBanner>
        </div>
      )}
      <p className="mb-4 text-sm text-white/50">
        Send orders from your own site directly into your dashboard by calling this endpoint with
        your API key.
      </p>

      {revealedKey && (
        <div className="mb-4 animate-fade-in rounded-lg border border-status-warning/30 bg-status-warning/10 p-3">
          <p className="mb-2 text-xs font-semibold text-status-warning">
            Copy this now — you won&apos;t be able to see it again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded bg-black/30 px-2 py-1.5 text-xs text-white">
              {revealedKey}
            </code>
            <Button variant="accent-outline" onClick={copyKey}>
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
        </div>
      )}

      {prefix ? (
        <div className="mb-4 rounded-lg border border-white/10 bg-white/5 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/40">Active key</p>
          <p className="mt-1 font-mono text-sm text-white">{prefix}…</p>
        </div>
      ) : (
        <p className="mb-4 text-sm text-white/40">No API key generated yet.</p>
      )}

      <div className="flex gap-3">
        <Button disabled={busy} onClick={() => setConfirmOpen("generate")}>
          {busy && <Spinner className="h-4 w-4" />}
          {prefix ? "Regenerate Key" : "Generate API Key"}
        </Button>
        {prefix && (
          <Button variant="accent-outline" disabled={busy} onClick={() => setConfirmOpen("revoke")}>
            Revoke
          </Button>
        )}
      </div>

      {prefix && (
        <details className="mt-4 text-sm text-white/50">
          <summary className="cursor-pointer text-white/70">How to use it</summary>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-black/30 p-3 text-xs text-white/80">
            {`curl -X POST ${endpoint} \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "customer_name": "Fatima Zahra",
    "customer_phone": "03001234567",
    "delivery_address": "House 12, Block 13-D2, Gulshan-e-Iqbal, Karachi"
  }'`}
          </pre>
        </details>
      )}

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
    </Card>
  );
}
