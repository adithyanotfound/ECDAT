/**
 * POST /api/repositories/[id]/scan
 * Manually triggers a MANUAL scan for a repository.
 * Works for both GitHub and AWS source types.
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

    const isAws = repo.sourceType === "AWS";

    // AWS repos don't have GitHub installations — validate AWS creds exist instead
    if (isAws && (!repo.awsAccessKey || !repo.awsSecretKey || !repo.awsRegion)) {
      return NextResponse.json(
        { error: "AWS repository is missing credentials. Set awsAccessKey, awsSecretKey, awsRegion." },
        { status: 400 }
      );
    }

    const scan = await prisma.scan.create({
      data: {
        repositoryId,
        trigger: "MANUAL",
        status: "QUEUED",
        commitSha: isAws ? "aws-manual" : "manual",
        ref: `refs/heads/${repo.defaultBranch}`,
      },
    });

    // For AWS: installationId is 0 (not used). Scanner routes on sourceType.
    const installationId = repo.installation?.githubInstallationId ?? 0;

    await enqueueJob("PUSH_SCAN", {
      scanId: scan.id,
      repositoryId,
      installationId,
      owner: repo.owner,
      repo: repo.name,
      ref: `refs/heads/${repo.defaultBranch}`,
      commitSha: isAws ? "aws-manual" : "manual",
    });

    return NextResponse.json({ scanId: scan.id }, { status: 202 });
  } catch (err) {
    console.error("[trigger-scan] error:", err);
    return NextResponse.json({ error: "Failed to enqueue scan" }, { status: 500 });
  }
}
