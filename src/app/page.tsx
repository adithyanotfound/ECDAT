/**
 * The public landing page. Signed-in visitors see "Open the dashboard"
 * instead of "Sign in with GitHub".
 */
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/server/auth/session";
import { LandingPage } from "@/components/landing/LandingPage";

export const metadata: Metadata = {
  title: { absolute: "Vajra · Find the cryptography quantum computers will break" },
};

export default async function Home() {
  const token = (await cookies()).get("session")?.value;
  const signedIn = token ? Boolean(await verifySessionToken(token).catch(() => null)) : false;
  return <LandingPage signedIn={signedIn} />;
}
