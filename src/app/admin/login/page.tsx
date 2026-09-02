"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MerchantButton, MerchantCard, MerchantInput } from "@/components/merchant/MerchantUi";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { Spinner } from "@/components/ui/Spinner";
import { Logo } from "@/components/ui/Logo";
import { createAuthBrowserClient } from "@/lib/supabase/browserAuth";

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.8}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.8}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 118 0v3" />
    </svg>
  );
}

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get("error") !== "not_authorized") return;

    setError(
      "Your account signed in successfully, but isn't provisioned for platform admin access yet."
    );

    // Still authenticated but not allowlisted — sign out so re-login works
    // after provisioning without bouncing /admin → login in a loop.
    void createAuthBrowserClient().auth.signOut();
  }, [searchParams]);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createAuthBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(signInError.message || "Sign-in failed.");
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#eef1f6] p-6">
      <div className="mb-8 flex flex-col items-center text-center">
        <Logo size={56} />
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Rider Tracking</h1>
        <p className="mt-1 text-sm text-slate-500">Platform Admin</p>
      </div>

      <MerchantCard className="w-full max-w-sm" title="Sign in">
        {error ? (
          <div className="mb-4">
            <StatusBanner tone="danger">{error}</StatusBanner>
          </div>
        ) : null}
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Email address
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <MailIcon />
              </span>
              <MerchantInput
                type="email"
                placeholder="admin@ridertracking.pk"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                className="pl-10"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Password
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <LockIcon />
              </span>
              <MerchantInput
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                className="pl-10"
              />
            </div>
          </div>
          <MerchantButton className="w-full" onClick={submit} disabled={loading}>
            {loading ? <Spinner className="h-4 w-4" /> : null}
            {loading ? "Signing in…" : "Sign In"}
          </MerchantButton>
        </div>
        <p className="mt-4 text-center text-xs text-slate-500">
          Platform admin accounts are provisioned manually — there is no self-service signup.
        </p>
      </MerchantCard>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense>
      <AdminLoginForm />
    </Suspense>
  );
}
