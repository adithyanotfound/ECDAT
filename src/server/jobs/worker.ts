/**
 * DB-backed job worker.
 *
 * Claims jobs atomically via SELECT FOR UPDATE SKIP LOCKED —
 * no Redis, no external queue. Safe to run multiple instances concurrently.
 *
 * Called from instrumentation.ts register() so it starts once per process.
 */
import { randomUUID } from "crypto";
import pLimit from "p-limit";
import { prisma } from "@/server/db/client";
import { runScanner } from "./scanner";
import type { ScanJobPayload } from "./queue";

const POLL_INTERVAL_MS = 3_000;
const CONCURRENCY = 2;
const limit = pLimit(CONCURRENCY);

const workerId = randomUUID();

async function claimNextJob() {
  // SELECT FOR UPDATE SKIP LOCKED — atomic claim, no double-processing
  const [job] = await prisma.$queryRaw<
    Array<{
      id: string;
      type: string;
      payload: unknown;
    }>
  >`
    UPDATE "Job"
    SET status = 'RUNNING',
        "lockedBy" = ${workerId},
        "lockedAt" = now(),
        attempts = attempts + 1
    WHERE id = (
      SELECT id FROM "Job"
      WHERE (status = 'QUEUED' AND "runAfter" <= now())
         -- A job whose worker vanished mid-scan (a serverless instance that was
         -- frozen or recycled) is picked up again, within its attempt limit.
         OR (status = 'RUNNING' AND "lockedAt" < now() - interval '15 minutes' AND attempts < "maxAttempts")
      ORDER BY "runAfter" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id, type, payload
  `;
  return job ?? null;
}

async function processJob(job: { id: string; type: string; payload: unknown }) {
  const payload = job.payload as ScanJobPayload;
  const { scanId, repositoryId } = payload;

  try {
    await prisma.scan.update({
      where: { id: scanId },
      data: { status: "RUNNING" },
    });

    await prisma.scanLog.create({
      data: { scanId, level: "INFO", message: `Worker ${workerId} claimed job ${job.id}` },
    });

    const start = Date.now();
    const { assetsWritten, findingsWritten, filesScanned } = await runScanner(scanId, repositoryId, payload);
    const durationMs = Date.now() - start;

    await prisma.scan.update({
      where: { id: scanId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        durationMs,
        filesScanned,
      },
    });

    await prisma.job.update({
      where: { id: job.id },
      data: { status: "DONE" },
    });

    console.log(
      `[worker] job=${job.id} scan=${scanId} done in ${durationMs}ms assets=${assetsWritten} findings=${findingsWritten}`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[worker] job=${job.id} scan=${scanId} failed: ${message}`);

    await prisma.scan
      .update({
        where: { id: scanId },
        data: { status: "FAILED", errorMessage: message },
      })
      .catch(() => {});

    await prisma.job
      .update({
        where: { id: job.id },
        data: { status: "FAILED", error: message },
      })
      .catch(() => {});
  }
}

/**
 * Runs queued jobs one after another until the queue is empty or the time
 * budget is spent. Used on serverless hosts (Vercel), where there is no
 * long-lived process for the polling loop below; see ./kick.ts.
 */
export async function drainJobs(budgetMs: number): Promise<number> {
  const deadline = Date.now() + budgetMs;
  let processed = 0;
  while (Date.now() < deadline) {
    const job = await claimNextJob();
    if (!job) break;
    await processJob(job);
    processed += 1;
  }
  return processed;
}

let running = false;

export function startWorker() {
  if (running) return;
  running = true;
  console.log(`[worker] starting (id=${workerId}, concurrency=${CONCURRENCY})`);

  const poll = async () => {
    try {
      const job = await claimNextJob();
      if (job) {
        // Don't await — let poll loop keep claiming while processing
        limit(() => processJob(job)).catch(() => {});
      }
    } catch (err) {
      // Log only the message, never the raw error object — an Octokit
      // error can carry the full request (including the Authorization
      // header with a live installation token) on its `.request` property.
      console.error("[worker] poll error:", err instanceof Error ? err.message : String(err));
    } finally {
      setTimeout(poll, POLL_INTERVAL_MS);
    }
  };

  poll();
}
