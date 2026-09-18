/**
 * Risk scoring engine persistence/orchestration — Phase 4, Step 5.
 *
 * Mirrors the detectors' "pure module -> persistence/orchestration module"
 * architecture: crsf.ts/pqc.ts/cis.ts/mosca.ts are pure and DB-free; this
 * module fetches the Repository and the CryptoAssets touched by *this*
 * scan's three detectors, runs the pure scoring functions, and upserts
 * RiskAssessment rows.
 *
 * Only scores the CryptoAssets the JS/TS, manifest and certificate/key
 * detectors actually touched this scan (their returned `assetIds`, unioned
 * and deduplicated by scanner.ts) — it does not rescore the repository's
 * entire historical asset inventory.
 */
import { prisma } from "@/server/db/client";
import { computeCrsfScore, deriveRiskCategory } from "./crsf";
import { computePqcSafetyScore } from "./pqc";
import { computeCisConformance } from "./cis";
import { computeMoscaVerdict } from "./mosca";
import { deriveFindingsForAsset, type FindingCandidate } from "@/server/findings/derive";
import { persistFindings } from "@/server/findings/persist";
import type { RepositoryCriticality, RiskCategory, ScoringInput } from "./types";

export type ScoringLogLevel = "INFO" | "WARN" | "ERROR";
export type ScoringLogger = (level: ScoringLogLevel, message: string) => void | Promise<void>;

export interface RunScoringPassOptions {
  repositoryId: string;
  scanId: string;
  /** CryptoAsset IDs touched this scan by the JS/TS, manifest and cert/key detectors (union, deduplicated). */
  assetIds: string[];
  onLog?: ScoringLogger;
}

export interface ScoringPassResult {
  assetsScored: number;
  distribution: Record<RiskCategory, number>;
  findingsCreated: number;
  findingsUpdated: number;
  findingsResolved: number;
}

function emptyDistribution(): Record<RiskCategory, number> {
  return { SAFE: 0, LOW: 0, MODERATE: 0, HIGH: 0, CRITICAL: 0 };
}

export async function runScoringPass(options: RunScoringPassOptions): Promise<ScoringPassResult> {
  const { repositoryId, assetIds } = options;
  const onLog: ScoringLogger = options.onLog ?? (() => {});
  const distribution = emptyDistribution();

  const uniqueAssetIds = [...new Set(assetIds)];
  if (uniqueAssetIds.length === 0) {
    await onLog("INFO", "[scoring] no assets to score");
    return { assetsScored: 0, distribution, findingsCreated: 0, findingsUpdated: 0, findingsResolved: 0 };
  }

  // Fetched once and reused for every asset — CRITICAL/LOW etc. and data
  // lifetime never change per-asset within a single scoring pass.
  const repository = await prisma.repository.findUniqueOrThrow({
    where: { id: repositoryId },
    select: { criticality: true, dataLifetimeYears: true },
  });

  const assets = await prisma.cryptoAsset.findMany({
    where: { id: { in: uniqueAssetIds }, repositoryId },
    select: {
      id: true,
      kind: true,
      name: true,
      algorithm: true,
      keyLengthBits: true,
      quantumSafe: true,
      curve: true,
      usageCount: true,
      filePath: true,
      lineNumber: true,
    },
  });

  const findingCandidates: FindingCandidate[] = [];

  let assetsScored = 0;
  for (const asset of assets) {
    const input: ScoringInput = {
      kind: asset.kind,
      algorithm: asset.algorithm,
      keyLengthBits: asset.keyLengthBits,
      quantumSafe: asset.quantumSafe,
      curve: asset.curve,
      usageCount: asset.usageCount,
      repositoryCriticality: repository.criticality as RepositoryCriticality,
      repositoryDataLifetimeYears: repository.dataLifetimeYears,
    };

    const crsfScore = computeCrsfScore(input);
    const pqcSafetyScore = computePqcSafetyScore(input);
    const { cisScore, cisExplanation } = computeCisConformance(input);
    const { moscaX, moscaY, moscaZ, moscaVerdict } = computeMoscaVerdict(input);
    const riskCategory = deriveRiskCategory(crsfScore);

    const fields = { crsfScore, cisScore, pqcSafetyScore, riskCategory, moscaX, moscaY, moscaZ, moscaVerdict, cisExplanation };

    // RiskAssessment is 1:1 with CryptoAsset — upsert on cryptoAssetId so a
    // rescan updates the existing row instead of failing on the unique
    // constraint or leaving a stale score behind.
    await prisma.riskAssessment.upsert({
      where: { cryptoAssetId: asset.id },
      create: { cryptoAssetId: asset.id, ...fields },
      update: fields,
    });

    distribution[riskCategory]++;
    assetsScored++;

    // Finding derivation (Phase 5, Step 7) — pure logic, runs off the same
    // asset this iteration just scored. Persistence happens once for the
    // whole batch, after this loop.
    findingCandidates.push(
      ...deriveFindingsForAsset(
        {
          id: asset.id,
          kind: asset.kind,
          name: asset.name,
          algorithm: asset.algorithm,
          keyLengthBits: asset.keyLengthBits,
          curve: asset.curve,
          quantumSafe: asset.quantumSafe,
          filePath: asset.filePath,
          lineNumber: asset.lineNumber,
        },
        repository.criticality as RepositoryCriticality
      )
    );
  }

  await onLog("INFO", `[scoring] scored ${assetsScored} assets`);
  await onLog(
    "INFO",
    `[scoring] distribution: ${distribution.CRITICAL} critical, ${distribution.HIGH} high, ${distribution.MODERATE} moderate, ${distribution.LOW} low, ${distribution.SAFE} safe`
  );

  const { created, updated, resolved } = await persistFindings(repositoryId, options.scanId, findingCandidates);
  await onLog("INFO", `[findings] ${created} findings created, ${updated} updated, ${resolved} resolved`);

  return { assetsScored, distribution, findingsCreated: created, findingsUpdated: updated, findingsResolved: resolved };
}
