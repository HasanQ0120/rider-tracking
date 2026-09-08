"use client";

import { logoutPortal } from "@/lib/api/auth";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function MerchantUserMenu({
  name,
  merchantId,
  primaryColor,
}: {
  name: string;
  merchantId: string;
  primaryColor: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initial = name.charAt(0).toUpperCase();

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    await logoutPortal();
    router.push("/merchant/login");
    router.refresh();
  }

  return (
    <div ref={ref} className="relative ml-auto">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-3 rounded-full bg-slate-100 px-2.5 py-1.5 transition-colors hover:bg-slate-200/80"
      >
        <span
          className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{ backgroundColor: primaryColor }}
        >
          {initial}
        </span>
        <span className="hidden text-left lg:block">
          <span className="block text-sm font-semibold text-slate-800">{name}</span>
          <span className="block text-xs text-slate-500">{merchantId}</span>
        </span>
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Account
          </p>
          <Link
            href="/merchant/account"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" />
            </svg>
            Profile
          </Link>
          <div className="my-1 border-t border-slate-100" />
          <button
            type="button"
            onClick={logout}
            disabled={loggingOut}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {loggingOut ? "Logging out…" : "Logout"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
