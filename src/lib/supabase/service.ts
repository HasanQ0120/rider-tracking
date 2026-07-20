import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service-role client: bypasses RLS entirely. Only ever imported from
// server-side code (Route Handlers, the cron notification processor).
// The `server-only` import makes an accidental client-bundle inclusion a
// build-time error instead of a leaked secret.
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase service credentials are not configured");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
