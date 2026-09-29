import { prisma } from "./src/server/db/client";
import { repositories } from "./src/fixtures/repositories";
import { cryptoAssets, findings } from "./src/fixtures/assets";
import { getRecommendation } from "./src/server/engine/recommendations";
import type { NormalizedHit } from "./src/server/engine/types";
import type { CryptoKind, FindingStatus, Severity } from "./src/generated/prisma/enums";

async function main() {
  console.log("Seeding data for admin user from fixtures...");

  // 1. Get the admin's existing AWS repo if any (to not delete it)
  const existingAws = await prisma.repository.findMany({ where: { owner: "admin", sourceType: "AWS" } });

  // Clean up non-AWS repos and their dependents for admin to start fresh
  const reposToDelete = await prisma.repository.findMany({ where: { owner: "admin", sourceType: { not: "AWS" } } });
  const repoIds = reposToDelete.map((r) => r.id);

  if (repoIds.length > 0) {
    // Children before parents, the same order as DELETE /api/repositories/[id].
    const inRepos = { repositoryId: { in: repoIds } };
    await prisma.$transaction([
      prisma.scanLog.deleteMany({ where: { scan: inRepos } }),
      prisma.cbom.deleteMany({ where: { scan: inRepos } }),
      prisma.findingAsset.deleteMany({ where: { finding: inRepos } }),
      prisma.riskAssessment.deleteMany({ where: { cryptoAsset: inRepos } }),
      prisma.finding.deleteMany({ where: inRepos }),
      prisma.cryptoAsset.deleteMany({ where: inRepos }),
      prisma.recommendation.deleteMany({ where: inRepos }),
      prisma.scan.deleteMany({ where: inRepos }),
      prisma.repository.deleteMany({ where: { id: { in: repoIds } } }),
    ]);
  }

  for (const r of repositories) {
    console.log(`Inserting repo: ${r.fullName}`);
    // Create Repo
    const repo = await prisma.repository.create({
      data: {
        id: r.id,
        owner: "admin", // Assign to admin
        name: r.fullName.split("/")[1],
        fullName: r.fullName,
        sourceType: "GITHUB",
        scanEnabled: r.scanEnabled,
        language: r.language,
        defaultBranch: "main",
      },
    });

    // Create a completed scan for this repo so it shows up in "Repos Scanned"
    await prisma.scan.create({
      data: {
        repository: { connect: { id: repo.id } },
        status: "COMPLETED",
        trigger: "MANUAL",
        commitSha: "HEAD",
        ref: "main",
        completedAt: new Date(),
      },
    });
  }

  // 2. Insert crypto assets
  for (const a of cryptoAssets) {
    // Map kinds correctly
    const kindMap: Record<string, CryptoKind> = {
      Algorithm: "ALGORITHM",
      Certificate: "CERTIFICATE",
      Key: "KEY",
      Protocol: "PROTOCOL",
      Library: "LIBRARY",
      Secret: "SECRET",
    };

    // Only insert if the repo exists in our fixtures (some assets might belong to other repos)
    const repoExists = repositories.find((r) => r.id === a.repositoryId);
    if (!repoExists) continue;

    console.log(`Inserting asset: ${a.name}`);
    const scan = await prisma.scan.findFirst({ where: { repositoryId: a.repositoryId } });
    const asset = await prisma.cryptoAsset.create({
      data: {
        id: a.id,
        repository: { connect: { id: a.repositoryId } },
        firstSeenScan: { connect: { id: scan!.id } },
        lastSeenScan: { connect: { id: scan!.id } },
        fingerprint: a.id,
        kind: kindMap[a.kind] || "ALGORITHM",
        name: a.name,
        primitive: a.primitive,
        algorithm: a.algorithm,
        keyLengthBits: a.keyLengthBits,
        curve: a.curve,
        quantumSafe: a.quantumSafe,
        filePath: a.filePath,
        usageCount: a.usageCount,
        riskAssessment: {
          create: {
            crsfScore: a.crsfScore,
            pqcSafetyScore: a.pqcSafetyScore,
            riskCategory: a.severity.toUpperCase(),
            // Fixtures carry no verdict; derive one the way the engine would read it.
            moscaVerdict: a.moscaVerdict ?? (a.quantumSafe ? "SAFE" : a.crsfScore >= 70 ? "ACT_NOW" : "PLAN"),
          },
        },
      },
    });
  }

  // 3. Insert findings
  for (const f of findings) {
    const repoExists = repositories.find((r) => r.id === f.repositoryId);
    if (!repoExists) continue;

    console.log(`Inserting finding: ${f.title}`);
    const scan = await prisma.scan.findFirst({ where: { repositoryId: f.repositoryId } });
    await prisma.finding.create({
      data: {
        id: f.id,
        repository: { connect: { id: f.repositoryId } },
        firstSeenScan: { connect: { id: scan!.id } },
        lastSeenScan: { connect: { id: scan!.id } },
        severity: f.severity.toUpperCase() as Severity,
        code: f.code,
        title: f.title,
        detail: f.detail,
        affectedComponent: f.affectedComponent,
        filePath: f.filePath,
        status: f.status.toUpperCase() as FindingStatus,
      },
    });
  }

  // 4. Recommendations, from the same migration table real scans use
  const seen = new Set<string>();
  for (const a of cryptoAssets) {
    if (!repositories.some((r) => r.id === a.repositoryId)) continue;
    const reco = getRecommendation({
      kind: a.kind.toUpperCase(),
      canonicalName: a.name,
      primitive: a.primitive,
      quantumSafe: a.quantumSafe ?? undefined,
    } as NormalizedHit);
    const key = `${a.repositoryId}:${reco?.fromAlgorithm}`;
    if (!reco || seen.has(key)) continue;
    seen.add(key);
    await prisma.recommendation.create({ data: { repositoryId: a.repositoryId, ...reco } });
  }

  console.log("✅ Done seeding! Dashboard will now be fully populated.");
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
