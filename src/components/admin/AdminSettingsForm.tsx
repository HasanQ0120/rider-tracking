"use client";

import { useState } from "react";
import {
  MerchantButton,
  MerchantCard,
  MerchantInput,
  MerchantPageHeader,
} from "@/components/merchant/MerchantUi";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { Spinner } from "@/components/ui/Spinner";
import { createAuthBrowserClient } from "@/lib/supabase/browserAuth";

export function AdminSettingsForm({ email }: { email: string | null }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function changePassword() {
    setMessage(null);
    if (password.length < 8) {
      setMessage({ tone: "danger", text: "Password must be at least 8 characters." });
      return;
    }
    if (password !== confirm) {
      setMessage({ tone: "danger", text: "Passwords do not match." });
      return;
    }

    setSaving(true);
    try {
      const supabase = createAuthBrowserClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setMessage({ tone: "danger", text: error.message || "Password update failed." });
        return;
      }
      setPassword("");
      setConfirm("");
      setMessage({ tone: "success", text: "Password updated." });
    } catch {
      setMessage({ tone: "danger", text: "Couldn't reach the server." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <MerchantPageHeader
        title="Settings"
        subtitle="Platform admin account preferences."
      />

      {message ? (
        <div className="mb-4">
          <StatusBanner tone={message.tone}>{message.text}</StatusBanner>
        </div>
      ) : null}

      <div className="grid max-w-xl gap-6">
        <MerchantCard title="Account">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</dt>
              <dd className="mt-1 text-slate-900">{email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Role</dt>
              <dd className="mt-1 text-slate-900">Platform admin</dd>
            </div>
          </dl>
        </MerchantCard>

        <MerchantCard title="Change password">
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                New password
              </label>
              <MerchantInput
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Confirm password
              </label>
              <MerchantInput
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat password"
              />
            </div>
            <MerchantButton onClick={changePassword} disabled={saving || !password}>
              {saving ? <Spinner className="h-4 w-4" /> : null}
              {saving ? "Updating…" : "Update password"}
            </MerchantButton>
          </div>
        </MerchantCard>
      </div>
    </div>
  );
}
