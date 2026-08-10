import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const protectedPaths = [
  "/dashboard",
  "/profile",
  "/chat",
  "/map",
  "/marketplace",
  "/reminders",
  "/wearables",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = protectedPaths.some((path) => pathname.startsWith(path));

  if (!isProtected) return NextResponse.next();

  // Cheap check only — confirms a session cookie is present and well-formed.
  // Doesn't hit the database (middleware runs on the edge). The dashboard
  // layout below does the real verification server-side.
  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/profile/:path*",
    "/chat/:path*",
    "/map/:path*",
    "/marketplace/:path*",
    "/reminders/:path*",
    "/wearables/:path*",
  ],
};