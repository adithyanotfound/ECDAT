/**
 * Next.js instrumentation hook — runs once per process on startup.
 * Starts the DB-backed job worker so it polls for queued scans.
 * See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // @peculiar/x509 (certificate detector) needs this polyfill loaded before
    // its own module code runs — load it once, up front, for the whole process.
    await import("reflect-metadata");
    // Serverless hosts (Vercel) have no long-lived process to poll from; there,
    // routes run queued scans themselves (src/server/jobs/kick.ts).
    if (process.env.VERCEL) return;
    const { startWorker } = await import("./src/server/jobs/worker");
    startWorker();
  }
}
