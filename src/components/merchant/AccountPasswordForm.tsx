"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { createAuthBrowserClient } from "@/lib/supabase/browserAuth";

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
      const supabase = createAuthBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message || "Failed to update password.");
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
    <Card title="Change Password">
      {error && (
        <div className="mb-4">
          <StatusBanner tone="danger">{error}</StatusBanner>
        </div>
      )}
      {success && (
        <div className="mb-4">
          <StatusBanner tone="success">Password updated.</StatusBanner>
        </div>
      )}
      <div className="space-y-3">
        <Input
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Input
          type="password"
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <Button onClick={submit} disabled={submitting || !password || !confirmPassword}>
          {submitting && <Spinner className="h-4 w-4" />}
          {submitting ? "Updating…" : "Update Password"}
        </Button>
      </div>
    </Card>
  );
}
