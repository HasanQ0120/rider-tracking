import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Gates /merchant/* and /admin/* on a logged-in Supabase Auth session.
// /ops/* permanently redirects into Admin (Ops portal merged away).
// Role checks (platform_admins / merchant claims) live in each area's guards.
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Ops portal merged into Admin.
  if (pathname === "/ops" || pathname.startsWith("/ops/")) {
    const url = request.nextUrl.clone();
    if (pathname.startsWith("/ops/login")) {
      url.pathname = "/admin/login";
    } else {
      url.pathname = "/admin";
    }
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data } = await supabase.auth.getUser();

  const loginPath = pathname.startsWith("/merchant") ? "/merchant/login" : "/admin/login";
  const isLoginPage = pathname === loginPath;
  if (!data.user && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = loginPath;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/ops/:path*", "/ops", "/merchant/:path*", "/admin/:path*"],
};
