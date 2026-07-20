import { createClient } from "@supabase/supabase-js";

// Anon-key client for the rider/customer pages. These pages are not
// Supabase-Auth sessions -- the customer client authorizes itself for
// Realtime by calling realtime.setAuth() with a short-lived, server-minted
// JWT carrying an `order_id` claim (see /api/customer/[token]/init).
export function createBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
