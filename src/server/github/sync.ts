/**
 * Brings one GitHub App installation into ECDAT Atlas: records the
 * installation, adds every repository it can see, and queues a first scan for
 * any repository that has never been scanned.
 *
 * Used by both GitHub's post-install redirect (/api/github/setup) and the
 * "Sync with GitHub" button (/api/github/sync), so a missed redirect can
 * always be recovered from inside the app. Safe to run repeatedly: existing
 * rows are updated, and repositories that already have a scan aren't queued again.
 */
import { prisma } from "@/server/db/client";
import { getAppOctokit, getInstallationOctokit } from "@/server/github/auth";
import { enqueueJob } from "@/server/jobs/queue";

export interface SyncResult {
  accountLogin: string;
  /** Repositories the installation can see. */
  repositories: number;
  /** Repositories that weren't in ECDAT before this sync. */
  added: number;
  /** First scans queued by this sync. */
  scansStarted: number;
}

type InstallationOctokit = Awaited<ReturnType<typeof getInstallationOctokit>>;

export async function syncInstallation(installationId: number): Promise<SyncResult> {
  const appOctokit = getAppOctokit();
  const { data: installData } = await appOctokit.rest.apps.getInstallation({ installation_id: installationId });
  const account = installData.account as { login: string; type?: string; avatar_url?: string } | null;

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

  // Every page, not just the first 100 repositories.
  const octokit = await getInstallationOctokit(installationId);
  const repoList = await octokit.paginate(octokit.rest.apps.listReposAccessibleToInstallation, { per_page: 100 });

  let added = 0;
  let scansStarted = 0;

  for (const ghRepo of repoList) {
    const branch = ghRepo.default_branch ?? "main";
    const details = {
      installationId: installation.id,
      githubRepoId: ghRepo.id,
      defaultBranch: branch,
      language: ghRepo.language ?? null,
      isPrivate: ghRepo.private,
      scanEnabled: true,
    };

    // Match by GitHub id, or by name for a repository first added by hand
    // (names are unique, so creating a second row would fail).
    const existing = await prisma.repository.findFirst({
      where: { OR: [{ githubRepoId: ghRepo.id }, { fullName: ghRepo.full_name }] },
      select: { id: true },
    });
    const repo = existing
      ? await prisma.repository.update({ where: { id: existing.id }, data: details })
      : await prisma.repository.create({
          data: { ...details, fullName: ghRepo.full_name, owner: ghRepo.owner.login, name: ghRepo.name },
        });
    if (!existing) added += 1;

    const alreadyScanned = await prisma.scan.findFirst({ where: { repositoryId: repo.id }, select: { id: true } });
    if (alreadyScanned) continue;

    const commitSha = ghRepo.pushed_at
      ? await latestCommitSha(octokit, ghRepo.owner.login, ghRepo.name, branch)
      : "unknown";
    const ref = `refs/heads/${branch}`;
    const scan = await prisma.scan.create({
      data: { repositoryId: repo.id, trigger: "INITIAL", status: "QUEUED", commitSha, ref },
    });
    await enqueueJob("INITIAL_SCAN", {
      scanId: scan.id,
      repositoryId: repo.id,
      installationId,
      owner: ghRepo.owner.login,
      repo: ghRepo.name,
      ref,
      commitSha,
    });
    scansStarted += 1;
  }

  return { accountLogin: account?.login ?? "unknown", repositories: repoList.length, added, scansStarted };
}

/** Every installation of this App on the given GitHub account. */
export async function installationsForAccount(login: string): Promise<number[]> {
  const appOctokit = getAppOctokit();
  const all = await appOctokit.paginate(appOctokit.rest.apps.listInstallations, { per_page: 100 });
  return all
    .filter(
      (i) => (i.account as { login?: string } | null)?.login?.toLowerCase() === login.toLowerCase() && !i.suspended_at,
    )
    .map((i) => i.id);
}

async function latestCommitSha(
  octokit: InstallationOctokit,
  owner: string,
  repo: string,
  branch: string,
): Promise<string> {
  try {
    const { data } = await octokit.rest.repos.getBranch({ owner, repo, branch });
    return data.commit.sha.slice(0, 7);
  } catch {
    return "unknown";
  }
}
