"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MerchantButton, MerchantInput } from "@/components/merchant/MerchantUi";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { Spinner } from "@/components/ui/Spinner";
import { Logo } from "@/components/ui/Logo";
import { loginMerchant } from "@/lib/api/auth";
import { PORTAL_THEME } from "@/lib/portalTheme";
import axios from "axios";

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
      await loginMerchant(merchantId, password);
      const next = searchParams.get("next");
      const safeNext =
        next && next.startsWith("/") && !next.startsWith("//") ? next : "/merchant";
      router.push(safeNext);
      router.refresh();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        setError("Invalid Merchant ID or password.");
      } else {
        setError("Couldn't reach the server. Is the API running on NEXT_PUBLIC_API_URL?");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-[#eef1f6] p-6 text-slate-900"
      style={
        {
          "--merchant-primary": PORTAL_THEME.primary,
          "--merchant-secondary": PORTAL_THEME.secondary,
          "--merchant-accent": PORTAL_THEME.accent,
        } as React.CSSProperties
      }
    >
      <div className="mb-6 w-full max-w-md animate-slide-up overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="h-1.5 w-full" style={{ backgroundColor: PORTAL_THEME.primary }} />
        <div className="px-6 py-6 text-center">
          <div className="flex justify-center">
            <Logo size={56} />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">Rider Tracking</h1>
          <p className="mt-1 text-sm text-slate-500">Merchant portal</p>
        </div>
      </div>

      <div className="w-full max-w-md animate-scale-in rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-lg font-semibold text-slate-900">Sign in to your account</h2>
        <p className="mb-5 text-sm text-slate-500">Enter your merchant ID and password.</p>

        {error && (
          <div className="mb-4">
            <StatusBanner tone="danger">{error}</StatusBanner>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Merchant ID
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <UserIcon />
              </span>
              <MerchantInput
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
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Password
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <LockIcon />
              </span>
              <MerchantInput
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
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <EyeIcon off={showPassword} />
              </button>
            </div>
          </div>
          <MerchantButton className="w-full" onClick={submit} disabled={loading || !merchantId || !password}>
            {loading && <Spinner className="h-4 w-4" />}
            {loading ? "Signing in…" : "Sign in"}
          </MerchantButton>
        </div>

        <p className="mt-5 text-center text-xs text-slate-400">
          Merchant accounts are provisioned by Rider Tracking — there is no self-service signup.
        </p>
      </div>
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
