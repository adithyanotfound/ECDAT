/**
 * POST /api/repositories/[id]/scan
 * Manually triggers a MANUAL scan for a repository.
 * Used by the "New Scan" button on the repositories page.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/client";
import { enqueueJob } from "@/server/jobs/queue";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: repositoryId } = await params;

  try {
    const repo = await prisma.repository.findUnique({
      where: { id: repositoryId },
      include: { installation: { select: { githubInstallationId: true } } },
    });
    if (!repo) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!repo.scanEnabled) return NextResponse.json({ error: "Scanning disabled" }, { status: 400 });

    const scan = await prisma.scan.create({
      data: {
        repositoryId,
        trigger: "MANUAL",
        status: "QUEUED",
        commitSha: "manual",
        ref: `refs/heads/${repo.defaultBranch}`,
      },
    });

    await enqueueJob("PUSH_SCAN", {
      scanId: scan.id,
      repositoryId,
      installationId: repo.installation.githubInstallationId,
      owner: repo.owner,
      repo: repo.name,
      ref: `refs/heads/${repo.defaultBranch}`,
      commitSha: "manual",
    });

    return NextResponse.json({ scanId: scan.id }, { status: 202 });
  } catch (err) {
    console.error("[trigger-scan] error:", err);
    return NextResponse.json({ error: "Failed to enqueue scan" }, { status: 500 });
  }
}
