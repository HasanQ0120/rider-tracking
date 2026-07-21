"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { createAuthBrowserClient } from "@/lib/supabase/browserAuth";

function OpsLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // requireOpsUser() redirects a logged-in-but-not-provisioned account
    // back here with this param -- without reading it, that login looks
    // like it silently did nothing, which is exactly what was reported.
    if (searchParams.get("error") === "not_authorized") {
      setError(
        "Your account signed in successfully, but isn't provisioned for ops access yet. Ask an existing ops user to add you."
      );
    }
  }, [searchParams]);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createAuthBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(signInError.message || "Sign-in failed. Please try again.");
        return;
      }
      router.push("/ops");
      router.refresh();
    } catch {
      // A thrown (not returned) error -- e.g. a network failure -- would
      // otherwise fail silently with no user-facing feedback at all.
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
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

export default function OpsLoginPage() {
  return (
    <Suspense>
      <OpsLoginForm />
    </Suspense>
  );
}
