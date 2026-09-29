/**
 * POST /api/repositories/[id]/scan
 * Manually triggers a MANUAL scan for one of the signed-in user's repositories.
 * Works for both GitHub and AWS source types.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/client";
import { enqueueJob } from "@/server/jobs/queue";
import { notFound, sessionOr401 } from "@/server/auth/guard";
import { runJobsSoon } from "@/server/jobs/kick";

// On Vercel the queued scan runs in this invocation after the response (see runJobsSoon).
export const maxDuration = 300;

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await sessionOr401();
  if (session instanceof NextResponse) return session;

  const { id: repositoryId } = await params;

  try {
    const repo = await prisma.repository.findFirst({
      where: { id: repositoryId, owner: session.login },
      include: { installation: { select: { githubInstallationId: true } } },
    });
    if (!repo) return notFound("Repository not found");
    if (!repo.scanEnabled) {
      return NextResponse.json({ error: "Scanning is turned off for this repository." }, { status: 400 });
    }

    const isAws = repo.sourceType === "AWS";

    // AWS repos don't have GitHub installations — validate AWS creds exist instead
    if (isAws && (!repo.awsAccessKey || !repo.awsSecretKey || !repo.awsRegion)) {
      return NextResponse.json(
        { error: "This AWS source is missing its access keys. Remove it and connect it again." },
        { status: 400 },
      );
    }

    // Don't stack scans: one waiting or running scan per repository is enough.
    const active = await prisma.scan.findFirst({
      where: { repositoryId, status: { in: ["QUEUED", "RUNNING"] } },
      select: { id: true },
    });
    if (active) return NextResponse.json({ scanId: active.id, alreadyRunning: true }, { status: 202 });

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
      owner: repo.sourceType === "GITHUB" ? repo.fullName.split("/")[0] : repo.owner,
      repo: repo.name,
      ref: `refs/heads/${repo.defaultBranch}`,
      commitSha: isAws ? "aws-manual" : "manual",
    });

    runJobsSoon();
    return NextResponse.json({ scanId: scan.id }, { status: 202 });
  } catch (err) {
    console.error("[trigger-scan] error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Failed to start the scan" }, { status: 500 });
  }
}
