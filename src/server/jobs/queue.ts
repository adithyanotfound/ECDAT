/**
 * Job queue helpers — enqueue and claim jobs using the DB-backed Job table.
 * Worker claims via SELECT FOR UPDATE SKIP LOCKED (see worker.ts).
 */
import { prisma } from "@/server/db/client";

export type JobType = "INITIAL_SCAN" | "PUSH_SCAN";

export interface ScanJobPayload extends Record<string, unknown> {
  scanId: string;
  repositoryId: string;
  installationId: number;
  owner: string;
  repo: string;
  ref: string;
  commitSha: string;
}

export async function enqueueJob(
  type: JobType,
  payload: ScanJobPayload,
  runAfterMs = 0
): Promise<string> {
  const job = await prisma.job.create({
    data: {
      type,
      payload: payload as Parameters<typeof prisma.job.create>[0]["data"]["payload"],
      status: "QUEUED",
      runAfter: new Date(Date.now() + runAfterMs),
    },
    select: { id: true },
  });
  return job.id;
}
