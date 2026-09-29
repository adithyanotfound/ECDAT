/**
 * Data-access layer for the Dashboard page.
 * All queries return plain serialisable objects — no Prisma types leak to the UI.
 */
import { prisma } from "./client";
import type { DashboardAggregates, VulnBySource, PostureBreakdown, AssetByType } from "@/fixtures/types";
import { requireSession } from "@/server/auth/session";

export async function getDashboardAggregates(): Promise<DashboardAggregates> {
  const session = await requireSession();
  const owner = session.login;

  const [totalAssets, highRiskAssets, vulnAssets, assetsRaw] = await Promise.all([
    prisma.cryptoAsset.count({ where: { repository: { owner } } }),
    prisma.riskAssessment.count({ where: { crsfScore: { gte: 70 }, cryptoAsset: { repository: { owner } } } }),
    prisma.riskAssessment.count({ where: { crsfScore: { gt: 0 }, cryptoAsset: { repository: { owner } } } }),
    prisma.cryptoAsset.findMany({
      where: { repository: { owner } },
      select: { kind: true },
    }),
  ]);

  const kindCounts = assetsRaw.reduce(
    (acc, curr) => {
      acc[curr.kind] = (acc[curr.kind] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const assetsByKind = Object.entries(kindCounts)
    .map(([kind, _count]) => ({ kind, _count: { kind: _count } }))
    .sort((a, b) => b._count.kind - a._count.kind);

  // Quantum readiness: average PQC safety score, rolled up to 0–10.
  // Scoped to actual cryptographic primitives (algorithms, keys, certs) —
  // a LIBRARY row (dependency presence) or a PROTOCOL row (TLS version pin,
  // already captured separately as a finding) isn't itself a graded
  // primitive and would dilute the signal this score exists to give.
  // No scored assets means no score: never a made-up middle value.
  const avgPqc = await prisma.riskAssessment.aggregate({
    where: { cryptoAsset: { kind: { in: ["ALGORITHM", "CERTIFICATE", "KEY"] }, repository: { owner } } },
    _avg: { pqcSafetyScore: true },
    _count: { _all: true },
  });
  const quantumReadinessBasis = avgPqc._count._all;
  const quantumReadinessScore =
    quantumReadinessBasis > 0 && avgPqc._avg.pqcSafetyScore != null
      ? Math.round(avgPqc._avg.pqcSafetyScore * 10) / 10
      : null;

  // Repositories scanned
  const repositoriesScanned = await prisma.scan.findMany({
    where: { status: "COMPLETED", repository: { owner } },
    select: { repositoryId: true },
    distinct: ["repositoryId"],
  });

  // Build posture breakdown from risk assessments
  const allRiskAssessments = await prisma.riskAssessment.findMany({
    where: { cryptoAsset: { repository: { owner } } },
    select: { riskCategory: true },
  });
  const postureRaw = Object.entries(
    allRiskAssessments.reduce(
      (acc, { riskCategory }) => {
        acc[riskCategory] = (acc[riskCategory] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    ),
  ).map(([riskCategory, count]) => ({ riskCategory, _count: { riskCategory: count } }));
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

  // By artefact source — remap of the reference's "By Source Type" chart onto
  // the categories this build actually discovers (IMPLEMENTATION_PLAN.md §1
  // "Dashboard 'By Source Type' → By artefact source: Source Code ·
  // Dependencies · Certificates · Config · Secrets · Keystores · IaC").
  // By artefact source
  const openFindings = await prisma.finding.findMany({
    where: { status: "OPEN", repository: { owner } },
    select: { severity: true, filePath: true, code: true },
  });
  const sourceBuckets = ["Source Code", "Dependencies", "Certificates", "Config", "Secrets", "Keystores", "IaC"];
  const bySource: Record<string, { critical: number; high: number; moderate: number; low: number }> = {};
  for (const source of sourceBuckets) bySource[source] = { critical: 0, high: 0, moderate: 0, low: 0 };
  for (const f of openFindings) {
    const bucket = inferArtefactSource(f.filePath, f.code);
    const counts = bySource[bucket];
    if (f.severity === "CRITICAL") counts.critical++;
    else if (f.severity === "HIGH") counts.high++;
    else if (f.severity === "MODERATE") counts.moderate++;
    else if (f.severity === "LOW") counts.low++;
  }
  const vulnBySource: VulnBySource[] = sourceBuckets.map((source) => ({ source, ...bySource[source] }));

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
    where: { kind: "KEY", primitive: { not: null }, repository: { owner } },
    select: { name: true },
    take: 50,
  });
  const asymmetricKeys = await prisma.cryptoAsset.findMany({
    where: {
      kind: "ALGORITHM",
      primitive: { in: ["signature", "key-agreement"] },
      repository: { owner },
    },
    select: { name: true },
    take: 50,
  });

  const buildDistribution = (items: { name: string }[]) => {
    const counts: Record<string, number> = {};
    items.forEach((i) => {
      counts[i.name] = (counts[i.name] ?? 0) + 1;
    });
    const total = Object.values(counts).reduce((s, v) => s + v, 0) || 1;
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([name, count]) => ({
        name,
        percent: Math.round((count / total) * 100),
      }));
  };

  const vulnerableAssetsPercent = total > 0 ? Math.round((vulnAssets / total) * 100) : 0;

  return {
    quantumReadinessScore,
    quantumReadinessBasis,
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

function inferArtefactSource(filePath: string | null, ruleCode: string): string {
  const p = (filePath ?? "").toLowerCase();
  const code = ruleCode.toLowerCase();

  if (/\.tf$/.test(p) || /^protocol-terraform/.test(code)) return "IaC";
  if (/\.(yaml|yml)$/.test(p) && /(k8s|kube|deployment|secret)/.test(p)) return "IaC";
  if (/(nginx|apache|httpd|sshd_config|ssh_config|openssl\.cnf)/.test(p) || /^protocol-/.test(code)) return "Config";
  if (/\.(pem|crt|cer|der|jks|p12|pfx)$/.test(p) || /^cert-/.test(code)) {
    return /\.(jks|p12|pfx)$/.test(p) ? "Keystores" : "Certificates";
  }
  if (
    /(package\.json|requirements|pom\.xml|build\.gradle|go\.mod|cargo\.toml|cmakelists)/.test(p) ||
    /^manifest-/.test(code)
  ) {
    return "Dependencies";
  }
  if (/^secret-/.test(code)) return "Secrets";
  if (/^key-/.test(code)) return "Keystores";
  return "Source Code";
}
