import { NextRequest, NextResponse } from "next/server";
import { getTokenFromCookieHeader, verifySessionToken } from "@/server/auth/session";

export async function GET(req: NextRequest) {
  const cookieHeader = req.headers.get("cookie");
  const token = getTokenFromCookieHeader(cookieHeader);
  if (!token) {
    return NextResponse.json({ user: null });
  }
  const user = await verifySessionToken(token);
  return NextResponse.json({ user });
}
