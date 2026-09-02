import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Gates /ops/*, /merchant/*, and /admin/* on a logged-in Supabase Auth
// session. Whether that user is actually provisioned (ops_staff row,
// merchant app_metadata claim, or platform_admins row) is checked
// separately in each area's own layout/API routes.
export async function middleware(request: NextRequest) {
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

  const pathname = request.nextUrl.pathname;
  const loginPath = pathname.startsWith("/merchant")
    ? "/merchant/login"
    : pathname.startsWith("/admin")
      ? "/admin/login"
      : "/ops/login";
  const isLoginPage = pathname === loginPath;
  if (!data.user && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = loginPath;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/ops/:path*", "/merchant/:path*", "/admin/:path*"],
};
