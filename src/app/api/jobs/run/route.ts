/**
 * GET /api/jobs/run
 * Runs queued scans. Called by Vercel Cron (see vercel.json) as a safety net
 * for scans that weren't picked up straight after being queued. Vercel sends
 * "Authorization: Bearer <CRON_SECRET>" automatically; any other caller is refused.
 */
import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { DRAIN_BUDGET_MS } from "@/server/jobs/kick";
import { drainJobs } from "@/server/jobs/worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const digest = (v: string) => createHash("sha256").update(v).digest();

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET isn't set on this server." }, { status: 503 });
  }
  const given = req.headers.get("authorization") ?? "";
  if (!timingSafeEqual(digest(given), digest(`Bearer ${secret}`))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const processed = await drainJobs(DRAIN_BUDGET_MS);
    return NextResponse.json({ processed });
  } catch (err) {
    console.error("[jobs/run] error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Running jobs failed" }, { status: 500 });
  }
}
