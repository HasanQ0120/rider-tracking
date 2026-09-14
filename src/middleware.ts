import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE } from "@/lib/api/config";

async function hasValidSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const secret = process.env.SESSION_JWT_SECRET;
  if (!secret) return Boolean(token);
  try {
    await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}

// Gates /merchant/* and /admin/* on rider-tracking-api portal JWT (cookie rt_session).
// /ops/* permanently redirects into Admin.
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname === "/ops" || pathname.startsWith("/ops/")) {
    const url = request.nextUrl.clone();
    if (pathname.startsWith("/ops/login")) {
      url.pathname = "/admin/login";
    } else {
      url.pathname = "/admin";
    }
    return NextResponse.redirect(url);
  }

  const loginPath = pathname.startsWith("/merchant") ? "/merchant/login" : "/admin/login";
  const isLoginPage = pathname === loginPath;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const authed = await hasValidSession(token);

  if (!authed && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = loginPath;
    return NextResponse.redirect(url);
  }

  if (authed && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.startsWith("/merchant") ? "/merchant" : "/admin";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/ops/:path*", "/ops", "/merchant/:path*", "/admin/:path*"],
};
