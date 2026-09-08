/**
 * Next.js instrumentation hook — runs once per process on startup.
 * Starts the DB-backed job worker so it polls for queued scans.
 * See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startWorker } = await import("./src/server/jobs/worker");
    startWorker();
  }
}
