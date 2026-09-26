import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, makeSessionCookie } from "@/server/auth/session";

/**
 * POST /api/auth/login
 * Stateless JWT login — accepts username + password, issues an httpOnly
 * session cookie containing a signed JWT. No DB session storage.
 *
 * Credentials are read from env vars:
 *   AUTH_USERNAME  (defaults to "admin")
 *   AUTH_PASSWORD  (defaults to "ecdat2024")
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password } = body as { username?: string; password?: string };

    if (!username || !password) {
      return NextResponse.json({ error: "Username and password required." }, { status: 400 });
    }

    const validUsername = process.env.AUTH_USERNAME || "admin";
    const validPassword = process.env.AUTH_PASSWORD || "ecdat2024";

    if (username !== validUsername || password !== validPassword) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    const token = await createSessionToken({
      githubId: 0,
      login: username,
      avatarUrl: "",
      name: username,
    });

    const cookie = makeSessionCookie(token);
    const response = NextResponse.json({ ok: true });
    response.headers.set("Set-Cookie", cookie);
    return response;
  } catch {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
