/**
 * Request gate (Next 16 "proxy", formerly middleware).
 *
 * The session cookie is verified here, not just checked for presence: a
 * forged or expired cookie is treated exactly like no cookie. Pages redirect
 * to /login; API routes get a 401 so the UI can react instead of receiving a
 * login page as JSON.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken } from "@/server/auth/session";

// Reachable without signing in.
const PUBLIC_PAGES = new Set(["/", "/login"]);
const PUBLIC_API = [
  "/api/auth/logout",
  "/api/auth/me",
  "/api/github/login",
  "/api/github/callback",
  "/api/github/setup", // GitHub's post-install redirect; verified against the GitHub API
  "/api/github/webhook", // authenticated by its HMAC signature instead
  "/api/jobs/run", // Vercel Cron; authenticated by CRON_SECRET instead
];

// Files served from /public (landing images, icons).
const STATIC_FILE = /\.(?:png|jpe?g|webp|avif|gif|svg|ico|txt|xml|woff2?)$/i;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (STATIC_FILE.test(pathname)) return NextResponse.next();

  const token = request.cookies.get("session")?.value;
  const session = token ? await verifySessionToken(token).catch(() => null) : null;

  // Signed-in users skip the sign-in form.
  if (session && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const isPublic = PUBLIC_PAGES.has(pathname) || PUBLIC_API.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (session || isPublic) return NextResponse.next();

  const response = pathname.startsWith("/api/")
    ? NextResponse.json({ error: "Please sign in again." }, { status: 401 })
    : NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(pathname)}`, request.url));

  // A cookie that failed verification is useless; clear it.
  if (token) response.cookies.delete("session");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
