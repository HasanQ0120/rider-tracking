import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Cookie-backed Supabase Auth client for the ops panel. Used in Server
// Components, Route Handlers, and middleware to read/refresh the logged-in
// ops user's session. This is separate from the service-role client: ops
// data writes still go through the service-role client after this confirms
// the caller is an authenticated ops_staff member.
export async function createAuthServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component render; middleware refreshes the
            // session cookie on the next request instead.
          }
        },
      },
    }
  );
}
