/**
 * GET /api/github/setup?installation_id=&setup_action=
 * GitHub redirects here after the user installs (or updates) the App.
 *
 * Steps:
 *  1. Fetch the installation details (account, avatar)
 *  2. List all accessible repositories for this installation
 *  3. Upsert Installation + Repository rows
 *  4. Enqueue one INITIAL_SCAN job per new repository
 *  5. Redirect to /scanning/repositories
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/client";
import { getInstallationOctokit, getAppOctokit } from "@/server/github/auth";
import { enqueueJob } from "@/server/jobs/queue";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const installationId = Number(searchParams.get("installation_id"));
  const setupAction = searchParams.get("setup_action");

  if (!installationId || isNaN(installationId)) {
    return NextResponse.redirect(new URL("/scanning/repositories?error=missing_installation", req.url));
  }

  // Handle revocation
  if (setupAction === "delete") {
    await prisma.installation.updateMany({
      where: { githubInstallationId: installationId },
      data: { suspendedAt: new Date() },
    });
    await prisma.repository.updateMany({
      where: { installation: { githubInstallationId: installationId } },
      data: { scanEnabled: false },
    });
    return NextResponse.redirect(new URL("/scanning/repositories?uninstalled=1", req.url));
  }

  try {
    const appOctokit = getAppOctokit();

    // Fetch installation details
    const { data: installData } = await appOctokit.rest.apps.getInstallation({
      installation_id: installationId,
    });

    const account = installData.account as {
      login: string;
      type?: string;
      avatar_url?: string;
    } | null;

    // Upsert Installation row
    const installation = await prisma.installation.upsert({
      where: { githubInstallationId: installationId },
      create: {
        githubInstallationId: installationId,
        accountLogin: account?.login ?? "unknown",
        accountType: account?.type ?? "User",
        avatarUrl: account?.avatar_url ?? null,
      },
      update: {
        accountLogin: account?.login ?? "unknown",
        avatarUrl: account?.avatar_url ?? null,
        suspendedAt: null,
      },
    });

    // List all accessible repositories for this installation
    const octokit = await getInstallationOctokit(installationId);
    const { data: repoList } = await octokit.rest.apps.listReposAccessibleToInstallation({
      per_page: 100,
    });

    for (const ghRepo of repoList.repositories) {
      const commitSha = ghRepo.pushed_at
        ? await getLatestCommitSha(octokit, ghRepo.owner.login, ghRepo.name, ghRepo.default_branch ?? "main")
        : "unknown";

      // Upsert Repository
      const repo = await prisma.repository.upsert({
        where: { githubRepoId: ghRepo.id },
        create: {
          installationId: installation.id,
          githubRepoId: ghRepo.id,
          fullName: ghRepo.full_name,
          owner: ghRepo.owner.login,
          name: ghRepo.name,
          defaultBranch: ghRepo.default_branch ?? "main",
          language: ghRepo.language ?? null,
          isPrivate: ghRepo.private,
          scanEnabled: true,
        },
        update: {
          language: ghRepo.language ?? null,
          defaultBranch: ghRepo.default_branch ?? "main",
          scanEnabled: true,
        },
      });

      // Skip if already has a scan
      const existingScan = await prisma.scan.findFirst({
        where: { repositoryId: repo.id },
        select: { id: true },
      });
      if (existingScan) continue;

      // Create Scan row in QUEUED state
      const scan = await prisma.scan.create({
        data: {
          repositoryId: repo.id,
          trigger: "INITIAL",
          status: "QUEUED",
          commitSha,
          ref: `refs/heads/${ghRepo.default_branch ?? "main"}`,
        },
      });

      // Enqueue job
      await enqueueJob("INITIAL_SCAN", {
        scanId: scan.id,
        repositoryId: repo.id,
        installationId,
        owner: ghRepo.owner.login,
        repo: ghRepo.name,
        ref: `refs/heads/${ghRepo.default_branch ?? "main"}`,
        commitSha,
      });
    }

    return NextResponse.redirect(new URL("/scanning/repositories?connected=1", req.url));
  } catch (err) {
    console.error("[setup] error:", err);
    return NextResponse.redirect(new URL("/scanning/repositories?error=setup_failed", req.url));
  }
}

async function getLatestCommitSha(
  octokit: Awaited<ReturnType<typeof getInstallationOctokit>>,
  owner: string,
  repo: string,
  branch: string
): Promise<string> {
  try {
    const { data } = await octokit.rest.repos.getBranch({ owner, repo, branch });
    return data.commit.sha.slice(0, 7);
  } catch {
    return "unknown";
  }
}
