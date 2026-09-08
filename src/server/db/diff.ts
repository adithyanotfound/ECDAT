/**
 * The change-diff per push — artefacts and findings introduced, resolved and
 * unchanged since the previous scan of the same repository. The
 * [repositoryId, fingerprint] constraint on CryptoAsset (Phase 2) makes this
 * a handful of indexed queries: the screen that proves this is continuous
 * discovery, not a one-shot report. (IMPLEMENTATION_PLAN.md §Phase 5)
 */
import { prisma } from "./client";

export interface DiffAssetRow {
  id: string;
  name: string;
  kind: string;
  filePath: string;
  crsfScore: number;
  severity: string;
}

export interface DiffFindingRow {
  id: string;
  code: string;
  title: string;
  severity: string;
  filePath: string | null;
}

export interface ScanDiff {
  scanId: string;
  repositoryId: string;
  previousScanId: string | null;
  assetsIntroducedCount: number;
  assetsResolvedCount: number;
  assetsUnchangedCount: number;
  findingsIntroducedCount: number;
  findingsResolvedCount: number;
  findingsUnchangedCount: number;
  introducedAssets: DiffAssetRow[];
  resolvedAssets: DiffAssetRow[];
  introducedFindings: DiffFindingRow[];
  resolvedFindings: DiffFindingRow[];
}

const ROW_LIMIT = 200;

export async function getScanDiff(scanId: string): Promise<ScanDiff> {
  const scan = await prisma.scan.findUniqueOrThrow({
    where: { id: scanId },
    select: { repositoryId: true, startedAt: true },
  });

  const previous = await prisma.scan.findFirst({
    where: { repositoryId: scan.repositoryId, status: "COMPLETED", startedAt: { lt: scan.startedAt } },
    orderBy: { startedAt: "desc" },
    select: { id: true },
  });

  const [introducedAssetsRaw, resolvedAssetsRaw, assetsUnchangedCount] = await Promise.all([
    prisma.cryptoAsset.findMany({
      where: { repositoryId: scan.repositoryId, firstSeenScanId: scanId },
      include: { riskAssessment: { select: { crsfScore: true, riskCategory: true } } },
      take: ROW_LIMIT,
    }),
    previous
      ? prisma.cryptoAsset.findMany({
          where: { repositoryId: scan.repositoryId, lastSeenScanId: previous.id },
          include: { riskAssessment: { select: { crsfScore: true, riskCategory: true } } },
          take: ROW_LIMIT,
        })
      : Promise.resolve([]),
    prisma.cryptoAsset.count({
      where: { repositoryId: scan.repositoryId, lastSeenScanId: scanId, firstSeenScanId: { not: scanId } },
    }),
  ]);

  const [introducedFindingsRaw, resolvedFindingsRaw, findingsUnchangedCount] = await Promise.all([
    prisma.finding.findMany({
      where: { repositoryId: scan.repositoryId, firstSeenScanId: scanId },
      take: ROW_LIMIT,
    }),
    previous
      ? prisma.finding.findMany({
          where: { repositoryId: scan.repositoryId, lastSeenScanId: previous.id },
          take: ROW_LIMIT,
        })
      : Promise.resolve([]),
    prisma.finding.count({
      where: { repositoryId: scan.repositoryId, lastSeenScanId: scanId, firstSeenScanId: { not: scanId } },
    }),
  ]);

  const [introducedAssetsTotal, resolvedAssetsTotal, introducedFindingsTotal, resolvedFindingsTotal] = await Promise.all([
    prisma.cryptoAsset.count({ where: { repositoryId: scan.repositoryId, firstSeenScanId: scanId } }),
    previous
      ? prisma.cryptoAsset.count({ where: { repositoryId: scan.repositoryId, lastSeenScanId: previous.id } })
      : Promise.resolve(0),
    prisma.finding.count({ where: { repositoryId: scan.repositoryId, firstSeenScanId: scanId } }),
    previous
      ? prisma.finding.count({ where: { repositoryId: scan.repositoryId, lastSeenScanId: previous.id } })
      : Promise.resolve(0),
  ]);

  const mapAsset = (a: (typeof introducedAssetsRaw)[number]): DiffAssetRow => ({
    id: a.id,
    name: a.name,
    kind: a.kind,
    filePath: a.filePath,
    crsfScore: a.riskAssessment?.crsfScore ?? 0,
    severity: a.riskAssessment?.riskCategory ?? "SAFE",
  });
  const mapFinding = (f: (typeof introducedFindingsRaw)[number]): DiffFindingRow => ({
    id: f.id,
    code: f.code,
    title: f.title,
    severity: f.severity,
    filePath: f.filePath,
  });

  return {
    scanId,
    repositoryId: scan.repositoryId,
    previousScanId: previous?.id ?? null,
    assetsIntroducedCount: introducedAssetsTotal,
    assetsResolvedCount: resolvedAssetsTotal,
    assetsUnchangedCount,
    findingsIntroducedCount: introducedFindingsTotal,
    findingsResolvedCount: resolvedFindingsTotal,
    findingsUnchangedCount,
    introducedAssets: introducedAssetsRaw.map(mapAsset),
    resolvedAssets: resolvedAssetsRaw.map(mapAsset),
    introducedFindings: introducedFindingsRaw.map(mapFinding),
    resolvedFindings: resolvedFindingsRaw.map(mapFinding),
  };
}
