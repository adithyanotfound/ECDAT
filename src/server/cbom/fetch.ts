/**
 * CBOM data fetching — Phase 4, Step 6.
 *
 * The thin Prisma-fetching half of the builder (see build.ts's header for
 * the pure/impure split rationale). Isolated in its own module — separate
 * from the pure build.ts — specifically so build.test.ts can import the
 * pure builder without ever touching Prisma or requiring DATABASE_URL.
 */
import { prisma } from "@/server/db/client";
import { buildCbom } from "./build";
import type { CycloneDxBom } from "./types";

export async function buildCbomForScan(scanId: string): Promise<CycloneDxBom> {
  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
    select: { id: true, status: true, completedAt: true, repositoryId: true },
  });

  if (!scan) {
    throw new Error(`Cannot build CBOM: scan ${scanId} does not exist`);
  }
  if (scan.status !== "COMPLETED" || !scan.completedAt) {
    throw new Error(`Cannot build CBOM: scan ${scanId} is not completed`);
  }

  // Same query shape as src/server/db/assets.ts's getCryptoAssetsPage
  // (repositoryId filter + riskAssessment include), just unpaginated: the
  // CBOM must contain the full current inventory, not one page of it.
  const assets = await prisma.cryptoAsset.findMany({
    where: { repositoryId: scan.repositoryId },
    include: { riskAssessment: true },
  });

  return buildCbom({
    scanId: scan.id,
    completedAt: scan.completedAt,
    assets: assets.map((a) => ({
      fingerprint: a.fingerprint,
      kind: a.kind,
      name: a.name,
      primitive: a.primitive,
      keyLengthBits: a.keyLengthBits,
      curve: a.curve,
      mode: a.mode,
      quantumSafe: a.quantumSafe,
      executionEnvironment: a.executionEnvironment,
      classicalSecLevel: a.classicalSecLevel,
      usageCount: a.usageCount,
      riskAssessment: a.riskAssessment
        ? {
            crsfScore: a.riskAssessment.crsfScore,
            pqcSafetyScore: a.riskAssessment.pqcSafetyScore,
            riskCategory: a.riskAssessment.riskCategory,
            moscaVerdict: a.riskAssessment.moscaVerdict,
          }
        : null,
    })),
  });
}
