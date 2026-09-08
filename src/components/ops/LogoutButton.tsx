"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { logoutPortal } from "@/lib/api/auth";

export function LogoutButton() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    await logoutPortal();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <button
      onClick={logout}
      disabled={loggingOut}
      className="flex items-center gap-1.5 text-sm text-white/70 transition-colors hover:text-white disabled:opacity-50"
    >
      {loggingOut ? "Signing out…" : "Logout"}
    </button>
  );
}
