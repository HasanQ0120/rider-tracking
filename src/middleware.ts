import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Gates /ops/* and /merchant/* on a logged-in Supabase Auth session.
// Whether that user is actually provisioned as ops staff or a merchant
// (ops_staff row / tenant app_metadata claim) is checked separately in
// each area's own layout/API routes, which can reach the service-role
// client -- middleware here only refreshes the session and blocks
// anonymous access, redirecting to whichever login page matches the path
// being visited.
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

  const isMerchantArea = request.nextUrl.pathname.startsWith("/merchant");
  const loginPath = isMerchantArea ? "/merchant/login" : "/ops/login";
  const isLoginPage = request.nextUrl.pathname === loginPath;
  if (!data.user && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = loginPath;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/ops/:path*", "/merchant/:path*"],
};
