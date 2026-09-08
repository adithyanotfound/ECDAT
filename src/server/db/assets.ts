/**
 * Data-access layer for the Assets screens (Inventory, PQC, Vulnerabilities).
 * All sorting and pagination happens in SQL — no full-table reads in JS.
 */
import { prisma } from "./client";
import type {
  CryptoAsset,
  Finding,
  InventoryAsset,
  Severity,
  CryptoKind,
} from "@/fixtures/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapSeverity(s: string): Severity {
  const m: Record<string, Severity> = {
    CRITICAL: "Critical",
    HIGH: "High",
    MODERATE: "Moderate",
    LOW: "Low",
    COMPLIANT: "Compliant",
  };
  return m[s] ?? "Low";
}

function mapKind(k: string): CryptoKind {
  const m: Record<string, CryptoKind> = {
    ALGORITHM: "Algorithm",
    CERTIFICATE: "Certificate",
    KEY: "Key",
    PROTOCOL: "Protocol",
    LIBRARY: "Library",
    SECRET: "Secret",
  };
  return m[k] ?? "Algorithm";
}

// ─── Inventory ────────────────────────────────────────────────────────────────

export interface InventoryPageParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sort?: string;
  dir?: "asc" | "desc";
}

export interface InventoryPage {
  items: InventoryAsset[];
  total: number;
  totalAssets: number;
  classifiedAssets: number;
  monitoredAssets: number;
  newAssets: number;
}

export async function getInventoryPage({
  page = 1,
  pageSize = 10,
  search,
  sort = "lastDiscovered",
  dir = "desc",
}: InventoryPageParams = {}): Promise<InventoryPage> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const where = search
    ? {
        OR: [
          { fullName: { contains: search, mode: "insensitive" as const } },
          { name: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [repos, total, totalAssets, classifiedAssets, newAssets] = await Promise.all([
    prisma.repository.findMany({
      where,
      include: {
        scans: {
          where: { status: "COMPLETED" },
          orderBy: { completedAt: "desc" },
          take: 1,
          select: { completedAt: true },
        },
        cryptoAssets: { select: { id: true, kind: true } },
      },
      orderBy: dir === "desc"
        ? { updatedAt: "desc" }
        : { updatedAt: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.repository.count({ where }),
    prisma.repository.count(),
    prisma.repository.count({ where: { scanEnabled: true } }),
    prisma.repository.count({
      where: { createdAt: { gte: sevenDaysAgo } },
    }),
  ]);

  const items: InventoryAsset[] = repos.map((r, i) => ({
    id: r.id,
    assetId: `Asset-${r.id.slice(-4).toUpperCase()}`,
    lastDiscovered: r.updatedAt.toISOString(),
    ipHostname: r.fullName,
    ports: `${r.cryptoAssets.length} assets`,
    serviceTag: r.language ?? "Unknown",
    classified: r.scanEnabled,
    deepDiscovery: (r.scans.length > 0),
    lastScanned: r.scans[0]?.completedAt?.toISOString() ?? r.updatedAt.toISOString(),
  }));

  return {
    items,
    total,
    totalAssets,
    classifiedAssets,
    monitoredAssets: classifiedAssets,
    newAssets,
  };
}

// ─── CryptoAssets / PQC inventory ─────────────────────────────────────────────

export interface CryptoAssetsPageParams {
  repositoryId?: string;
  kind?: string;
  page?: number;
  pageSize?: number;
  search?: string;
  sort?: string;
  dir?: "asc" | "desc";
}

export interface CryptoAssetsPage {
  items: CryptoAsset[];
  total: number;
}

export async function getCryptoAssetsPage({
  repositoryId,
  kind,
  page = 1,
  pageSize = 20,
  search,
  sort = "crsfScore",
  dir = "desc",
}: CryptoAssetsPageParams = {}): Promise<CryptoAssetsPage> {
  const where = {
    ...(repositoryId ? { repositoryId } : {}),
    ...(kind ? { kind: kind as "ALGORITHM" } : {}),
    ...(search
      ? { name: { contains: search, mode: "insensitive" as const } }
      : {}),
  };

  const orderBy =
    sort === "crsfScore"
      ? { riskAssessment: { crsfScore: dir } as Record<string, "asc" | "desc"> }
      : sort === "name"
      ? { name: dir as "asc" | "desc" }
      : sort === "keyLengthBits"
      ? { keyLengthBits: dir as "asc" | "desc" }
      : sort === "usageCount"
      ? { usageCount: dir as "asc" | "desc" }
      : sort === "lastSeenAt"
      ? { updatedAt: dir as "asc" | "desc" }
      : { updatedAt: "desc" as const };

  const [rawItems, total] = await Promise.all([
    prisma.cryptoAsset.findMany({
      where,
      include: {
        riskAssessment: true,
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.cryptoAsset.count({ where }),
  ]);

  const items: CryptoAsset[] = rawItems.map((a) => {
    const risk = a.riskAssessment;
    const crsfScore = risk?.crsfScore ?? 0;
    const pqcScore = risk?.pqcSafetyScore ?? 0;
    return {
      id: a.id,
      repositoryId: a.repositoryId,
      kind: mapKind(a.kind),
      name: a.name,
      primitive: a.primitive ?? undefined,
      algorithm: a.algorithm ?? undefined,
      keyLengthBits: a.keyLengthBits ?? undefined,
      mode: a.mode ?? undefined,
      curve: a.curve ?? undefined,
      quantumSafe: a.quantumSafe,
      executionEnvironment: a.executionEnvironment ?? undefined,
      filePath: a.filePath,
      usageCount: a.usageCount,
      dependencies: a.usageCount,
      lastSeenAt: a.updatedAt.toISOString(),
      crsfScore,
      pqcSafetyScore: pqcScore,
      severity: crsfScore >= 70 ? "Critical" : crsfScore >= 45 ? "High" : crsfScore >= 20 ? "Moderate" : crsfScore >= 10 ? "Low" : "Compliant",
      moscaX: risk?.moscaX,
      moscaY: risk?.moscaY,
      moscaZ: risk?.moscaZ,
      moscaVerdict: risk?.moscaVerdict as CryptoAsset["moscaVerdict"],
    };
  });

  return { items, total };
}

// ─── Findings / Vulnerabilities ───────────────────────────────────────────────

export interface FindingsPageParams {
  repositoryId?: string;
  severity?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface FindingsPage {
  items: Finding[];
  total: number;
  openCount: number;
  criticalCount: number;
  highCount: number;
}

export async function getFindingsPage({
  repositoryId,
  severity,
  status,
  page = 1,
  pageSize = 10,
  search,
}: FindingsPageParams = {}): Promise<FindingsPage> {
  const where = {
    ...(repositoryId ? { repositoryId } : {}),
    ...(severity ? { severity: severity as "CRITICAL" } : {}),
    ...(status ? { status: status as "OPEN" } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" as const } },
            { code: { contains: search, mode: "insensitive" as const } },
            { detail: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [rawItems, total, openCount, criticalCount, highCount] = await Promise.all([
    prisma.finding.findMany({
      where,
      include: { repository: { select: { fullName: true } } },
      orderBy: [{ severity: "asc" }, { lastSeenAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.finding.count({ where }),
    prisma.finding.count({ where: { status: "OPEN" } }),
    prisma.finding.count({ where: { severity: "CRITICAL" } }),
    prisma.finding.count({ where: { severity: "HIGH" } }),
  ]);

  const items: Finding[] = rawItems.map((f) => ({
    id: f.id,
    code: f.code,
    repositoryId: f.repositoryId,
    repositoryFullName: f.repository.fullName,
    severity: mapSeverity(f.severity),
    title: f.title,
    detail: f.detail,
    affectedComponent: f.affectedComponent ?? "Unknown",
    filePath: f.filePath ?? "",
    status: (f.status.charAt(0) + f.status.slice(1).toLowerCase()) as Finding["status"],
    firstSeenAt: f.firstSeenAt.toISOString(),
    lastSeenAt: f.lastSeenAt.toISOString(),
  }));

  return { items, total, openCount, criticalCount, highCount };
}

// ─── CBOM report ──────────────────────────────────────────────────────────────

export async function getCbomForScan(scanId: string) {
  return prisma.cbom.findUnique({ where: { scanId } });
}
