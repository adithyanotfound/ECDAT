import "dotenv/config";
import { PrismaClient } from "./src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { enqueueJob } from "./src/server/jobs/queue";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const deliveries = await prisma.webhookDelivery.findMany({
    where: { event: "installation" },
    orderBy: { processedAt: 'desc' },
    take: 1
  });
  
  if (!deliveries.length) {
    console.log("No installation webhook found.");
    return;
  }
  
  // The stored "installation" webhook body; only the fields used below.
  const payload = deliveries[0].payload as {
    installation: { id: number; account: { login: string; type: string; avatar_url: string } };
    repositories?: { id: number; full_name: string; private: boolean }[];
  };
  const installationId = payload.installation.id;
  
  console.log(`Syncing installation ${installationId}...`);
  
  const installation = await prisma.installation.upsert({
    where: { githubInstallationId: installationId },
    create: {
      githubInstallationId: installationId,
      accountLogin: payload.installation.account.login,
      accountType: payload.installation.account.type,
      avatarUrl: payload.installation.account.avatar_url,
    },
    update: {
      accountLogin: payload.installation.account.login,
      avatarUrl: payload.installation.account.avatar_url,
      suspendedAt: null,
    },
  });
  
  const repos = payload.repositories || [];
  console.log(`Found ${repos.length} repositories to sync.`);
  
  for (const ghRepo of repos) {
    const [owner, name] = ghRepo.full_name.split("/");
    const repo = await prisma.repository.upsert({
      where: { githubRepoId: ghRepo.id },
      create: {
        installationId: installation.id,
        githubRepoId: ghRepo.id,
        fullName: ghRepo.full_name,
        owner: owner,
        name: name,
        defaultBranch: "main",
        language: null,
        isPrivate: ghRepo.private,
        scanEnabled: true,
      },
      update: {
        scanEnabled: true,
      },
    });

    const existingScan = await prisma.scan.findFirst({
      where: { repositoryId: repo.id },
      select: { id: true },
    });
    if (existingScan) continue;

    const scan = await prisma.scan.create({
      data: {
        repositoryId: repo.id,
        trigger: "INITIAL",
        status: "QUEUED",
        commitSha: "unknown",
        ref: "refs/heads/main",
      },
    });

    await enqueueJob("INITIAL_SCAN", {
      scanId: scan.id,
      repositoryId: repo.id,
      installationId,
      owner,
      repo: name,
      ref: "refs/heads/main",
      commitSha: "unknown",
    });
    console.log(`Queued scan for ${ghRepo.full_name}`);
  }
  console.log("Sync complete!");
}

main().finally(() => prisma.$disconnect());
