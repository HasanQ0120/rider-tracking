"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { Logo } from "@/components/ui/Logo";
import { createAuthBrowserClient } from "@/lib/supabase/browserAuth";

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" />
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

function EyeIcon({ off }: { off: boolean }) {
  return off ? (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M3 3l18 18" />
      <path d="M10.6 5.1A10.9 10.9 0 0112 5c5 0 9 4 10 7-.4 1.1-1.2 2.4-2.3 3.5M6.2 6.2C4.3 7.5 2.9 9.3 2 12c1 3 5 7 10 7 1 0 2-.2 2.9-.5" />
      <path d="M9.5 9.8a2.5 2.5 0 003.6 3.5" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

// Merchants only ever see "Merchant ID" -- Supabase Auth needs an
// email-shaped identity under the hood, so the public merchant_id is
// mapped to this fixed synthetic domain, invisible in the UI.
function merchantIdToEmail(merchantId: string) {
  return `${merchantId.trim().toLowerCase()}@merchants.internal`;
}

function MerchantLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [merchantId, setMerchantId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get("error") === "not_authorized") {
      setError("This account isn't provisioned for merchant access, or has been deactivated.");
    }
  }, [searchParams]);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createAuthBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: merchantIdToEmail(merchantId),
        password,
      });
      if (signInError) {
        setError("Invalid Merchant ID or password.");
        return;
      }
      router.push("/merchant");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface p-6">
      <div className="mb-8 flex flex-col items-center text-center animate-slide-up">
        <Logo size={56} />
        <h1 className="mt-4 text-2xl font-bold text-white">Rider Tracking</h1>
        <p className="mt-1 text-sm text-white/50">Merchant Portal</p>
      </div>

      <Card className="w-full max-w-sm animate-scale-in">
        <h2 className="mb-5 text-lg font-semibold text-white">Sign in to your account</h2>
        {error && (
          <div className="mb-4">
            <StatusBanner tone="danger">{error}</StatusBanner>
          </div>
        )}
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/50">
              Merchant ID
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40">
                <UserIcon />
              </span>
              <Input
                type="text"
                placeholder="MERCHANT001"
                value={merchantId}
                onChange={(e) => setMerchantId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                className="pl-10"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/50">
              Password
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40">
                <LockIcon />
              </span>
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                className="pl-10 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <EyeIcon off={showPassword} />
              </button>
            </div>
          </div>
          <Button className="w-full" onClick={submit} disabled={loading || !merchantId || !password}>
            {loading && <Spinner className="h-4 w-4" />}
            {loading ? "Signing in…" : "Sign In"}
          </Button>
        </div>
        <p className="mt-4 text-center text-xs text-white/40">
          Merchant accounts are provisioned by Rider Tracking — there is no self-service signup.
        </p>
      </Card>
    </div>
  );
}

export default function MerchantLoginPage() {
  return (
    <Suspense>
      <MerchantLoginForm />
    </Suspense>
  );
}
