"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { logoutPortal } from "@/lib/api/auth";

export function AdminLogoutButton() {
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
      className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
    >
      {loggingOut ? "Signing out…" : "Logout"}
    </button>
  );
}
