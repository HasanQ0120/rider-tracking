"use client";

import { useState } from "react";
import { MerchantButton, MerchantInput } from "@/components/merchant/MerchantUi";
import { Spinner } from "@/components/ui/Spinner";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { apiFetch } from "@/lib/api/browserFetch";

export function AccountPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setError(null);
    setSuccess(false);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Failed to update password.");
        return;
      }
      setPassword("");
      setConfirmPassword("");
      setSuccess(true);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h3 className="font-semibold text-slate-900">Change password</h3>
      <p className="mt-1 text-sm text-slate-500">
        Use at least 8 characters. Signing out of other sessions is recommended after a change.
      </p>
      {error && (
        <div className="mb-4 mt-4">
          <StatusBanner tone="danger">{error}</StatusBanner>
        </div>
      )}
      {success && (
        <div className="mb-4 mt-4">
          <StatusBanner tone="success">Password updated.</StatusBanner>
        </div>
      )}
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            New password
          </label>
          <MerchantInput
            type="password"
            placeholder="Enter new password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Confirm password
          </label>
          <MerchantInput
            type="password"
            placeholder="Repeat new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <MerchantButton onClick={submit} disabled={submitting || !password || !confirmPassword}>
          {submitting && <Spinner className="h-4 w-4" />}
          {submitting ? "Updating…" : "Update password"}
        </MerchantButton>
        <MerchantButton
          variant="secondary"
          onClick={() => {
            setPassword("");
            setConfirmPassword("");
            setError(null);
          }}
        >
          Cancel
        </MerchantButton>
      </div>
    </div>
  );
}
