/**
 * Getting queued scans to run on serverless hosts.
 *
 * Self-hosted, a long-lived process polls the Job table every few seconds
 * (instrumentation.ts → worker.ts). Vercel has no long-lived process, so any
 * route that queues a scan also calls runJobsSoon(): after the response is
 * sent, the same invocation keeps working through the queue (Next's after(),
 * bounded by the route's maxDuration). /api/jobs/run, called by Vercel Cron,
 * is the safety net for anything left behind.
 */
import { after } from "next/server";
import { drainJobs } from "./worker";

/** True on Vercel, where the polling worker can't run. */
export const isServerless = () => Boolean(process.env.VERCEL);

/**
 * Leave headroom under the routes' 300-second maxDuration: a scan that starts
 * just before the budget ends still has time to finish.
 */
export const DRAIN_BUDGET_MS = 180_000;

export function runJobsSoon(): void {
  if (!isServerless()) return;
  after(async () => {
    try {
      await drainJobs(DRAIN_BUDGET_MS);
    } catch (err) {
      console.error("[jobs] drain failed:", err instanceof Error ? err.message : String(err));
    }
  });
}
