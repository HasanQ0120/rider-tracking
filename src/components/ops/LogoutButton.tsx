"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createAuthBrowserClient } from "@/lib/supabase/browserAuth";

export function LogoutButton() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    const supabase = createAuthBrowserClient();
    await supabase.auth.signOut();
    router.push("/ops/login");
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
