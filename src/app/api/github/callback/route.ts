/**
 * GET /api/github/callback
 * GitHub redirects here after the user authorises the App.
 * Exchanges the code for a user access token, fetches the user profile,
 * upserts the User row, mints a signed session JWT, and redirects to /dashboard.
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/server/db/client";
import {
  createSessionToken,
  makeSessionCookie,
} from "@/server/auth/session";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  // CSRF check
  const cookieStore = await cookies();
  const savedState = cookieStore.get("oauth_state")?.value;
  cookieStore.delete("oauth_state");

  if (!code || !state || state !== savedState) {
    return NextResponse.redirect(new URL("/login?error=invalid_state", req.url));
  }

  try {
    // Exchange code → user access token
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/github/callback`,
      }),
    });
    const tokenData = await tokenRes.json() as { access_token?: string; error?: string };
    if (!tokenData.access_token) {
      console.error("[callback] token exchange failed:", tokenData.error);
      return NextResponse.redirect(new URL("/login?error=token_exchange", req.url));
    }

    // Fetch GitHub user profile
    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: "application/vnd.github+json",
      },
    });
    const ghUser = await userRes.json() as {
      id: number;
      login: string;
      avatar_url: string;
      name: string | null;
      email: string | null;
    };

    // Upsert the User row
    await prisma.user.upsert({
      where: { githubId: ghUser.id },
      create: {
        githubId: ghUser.id,
        login: ghUser.login,
        avatarUrl: ghUser.avatar_url,
        name: ghUser.name,
        email: ghUser.email,
      },
      update: {
        login: ghUser.login,
        avatarUrl: ghUser.avatar_url,
        name: ghUser.name,
        email: ghUser.email,
      },
    });

    // Mint session JWT
    const token = await createSessionToken({
      githubId: ghUser.id,
      login: ghUser.login,
      avatarUrl: ghUser.avatar_url,
      name: ghUser.name,
    });

    const response = NextResponse.redirect(new URL("/dashboard", req.url));
    response.headers.set("Set-Cookie", makeSessionCookie(token));
    return response;
  } catch (err) {
    console.error("[callback] error:", err);
    return NextResponse.redirect(new URL("/login?error=server_error", req.url));
  }
}
