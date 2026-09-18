/**
 * Data-access layer for the Dashboard page.
 * All queries return plain serialisable objects — no Prisma types leak to the UI.
 */
import { prisma } from "./client";
import type { DashboardAggregates, VulnBySource, PostureBreakdown, AssetByType } from "@/fixtures/types";

export async function getDashboardAggregates(): Promise<DashboardAggregates> {
  const [
    totalAssets,
    highRiskAssets,
    vulnAssets,
    assetsByKind,
  ] = await Promise.all([
    prisma.cryptoAsset.count(),
    prisma.riskAssessment.count({ where: { crsfScore: { gte: 70 } } }),
    prisma.riskAssessment.count({ where: { crsfScore: { gt: 0 } } }),
    prisma.cryptoAsset.groupBy({
      by: ["kind"],
      _count: { kind: true },
      orderBy: { _count: { kind: "desc" } },
    }),
  ]);

  // Quantum readiness: average PQC safety score across all assets (roll up to 0–10)
  const avgPqc = await prisma.riskAssessment.aggregate({
    _avg: { pqcSafetyScore: true },
  });
  const quantumReadinessScore = Math.round(avgPqc._avg.pqcSafetyScore ?? 5);

  // Repositories scanned
  const repositoriesScanned = await prisma.scan.findMany({
    where: { status: "COMPLETED" },
    select: { repositoryId: true },
    distinct: ["repositoryId"],
  });

  // Build posture breakdown from risk assessments
  const postureRaw = await prisma.riskAssessment.groupBy({
    by: ["riskCategory"],
    _count: { riskCategory: true },
  });
  const total = postureRaw.reduce((s, r) => s + r._count.riskCategory, 0) || 1;
  const posturePct = (cat: string) => {
    const found = postureRaw.find((r) => r.riskCategory === cat);
    return found ? Math.round((found._count.riskCategory / total) * 100) : 0;
  };
  const cryptographicPosture: PostureBreakdown = {
    high: posturePct("CRITICAL") + posturePct("HIGH"),
    medium: posturePct("MODERATE"),
    low: posturePct("LOW"),
    compliant: posturePct("SAFE"),
  };

  // By source type — real severity-segmented breakdown of OPEN findings,
  // grouped by the CryptoKind of each finding's triggering asset (via the
  // FindingAsset join). Only kinds an OPEN finding actually cites appear —
  // no fixed 7-row list, since PROTOCOL/SECRET detection isn't implemented
  // yet and would otherwise always render as a fake zero row.
  const kindToSourceLabel: Record<string, string> = {
    ALGORITHM: "Source Code",
    LIBRARY: "Dependencies",
    CERTIFICATE: "Certificates",
    KEY: "Keys",
    PROTOCOL: "Protocols",
    SECRET: "Secrets",
  };
  const openFindingsWithAssetKind = await prisma.finding.findMany({
    where: { status: "OPEN" },
    select: {
      severity: true,
      assets: { take: 1, select: { cryptoAsset: { select: { kind: true } } } },
    },
  });
  const bySource = new Map<string, VulnBySource>();
  for (const f of openFindingsWithAssetKind) {
    const kind = f.assets[0]?.cryptoAsset.kind;
    if (!kind) continue;
    const label = kindToSourceLabel[kind] ?? kind;
    const row = bySource.get(label) ?? { source: label, critical: 0, high: 0, moderate: 0, low: 0 };
    if (f.severity === "CRITICAL") row.critical++;
    else if (f.severity === "HIGH") row.high++;
    else if (f.severity === "MODERATE") row.moderate++;
    else if (f.severity === "LOW") row.low++;
    bySource.set(label, row);
  }
  const vulnBySource: VulnBySource[] = [...bySource.values()].sort(
    (a, b) => b.critical + b.high + b.moderate + b.low - (a.critical + a.high + a.moderate + a.low)
  );

  // Asset type distribution
  const kindLabel: Record<string, string> = {
    ALGORITHM: "Cipher Suites",
    CERTIFICATE: "Certificates",
    KEY: "Keys",
    PROTOCOL: "Protocols",
    LIBRARY: "Libraries",
    SECRET: "Keystores",
  };
  const assetsByType: AssetByType[] = assetsByKind.map((row) => ({
    type: kindLabel[row.kind] ?? row.kind,
    count: row._count.kind,
  }));

  // Key distributions — queried from actual assets
  const symmetricKeys = await prisma.cryptoAsset.findMany({
    where: { kind: "KEY", primitive: { not: null } },
    select: { name: true },
    take: 50,
  });
  const asymmetricKeys = await prisma.cryptoAsset.findMany({
    where: {
      kind: "ALGORITHM",
      primitive: { in: ["signature", "key-agreement"] },
    },
    select: { name: true },
    take: 50,
  });

  const buildDistribution = (items: { name: string }[]) => {
    const counts: Record<string, number> = {};
    items.forEach((i) => { counts[i.name] = (counts[i.name] ?? 0) + 1; });
    const total = Object.values(counts).reduce((s, v) => s + v, 0) || 1;
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([name, count]) => ({
        name,
        percent: Math.round((count / total) * 100),
      }));
  };

  const vulnerableAssetsPercent =
    total > 0 ? Math.round((vulnAssets / total) * 100) : 0;

  return {
    quantumReadinessScore,
    cryptographicAssetsCount: totalAssets,
    repositoriesScanned: repositoriesScanned.length,
    vulnerableAssetsPercent,
    highRiskAssets,
    vulnerabilitiesBySource: vulnBySource,
    cryptographicPosture,
    assetsByType,
    symmetricKeyDistribution: buildDistribution(symmetricKeys),
    asymmetricKeyDistribution: buildDistribution(asymmetricKeys),
  };
}
