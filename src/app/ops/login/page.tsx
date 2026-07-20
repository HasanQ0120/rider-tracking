"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { createAuthBrowserClient } from "@/lib/supabase/browserAuth";

export default function OpsLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError(null);
    const supabase = createAuthBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.push("/ops");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-6">
      <div className="w-full max-w-sm">
        <h1 className="mb-4 text-xl font-semibold text-brand-navy">Ops Login</h1>
        {error && (
          <div className="mb-3">
            <StatusBanner tone="danger">{error}</StatusBanner>
          </div>
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-3 w-full rounded-lg border border-brand-navy/30 px-4 py-2"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded-lg border border-brand-navy/30 px-4 py-2"
        />
        <Button className="w-full" onClick={submit} disabled={loading}>
          {loading ? "Signing in…" : "Sign In"}
        </Button>
        <p className="mt-4 text-xs text-brand-navy/60">
          Ops accounts are provisioned manually — there is no self-service signup.
        </p>
      </div>
    </div>
  );
}
