import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/server/auth/session";

export async function POST() {
  const response = NextResponse.redirect(
    new URL("/login", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000")
  );
  response.headers.set("Set-Cookie", clearSessionCookie());
  return response;
}
