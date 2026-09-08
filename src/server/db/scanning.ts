/**
 * Data-access layer for scanning screens (Repositories, Profiles, Scans).
 */
import { prisma } from "./client";
import type { Repository, Scan, ScanProfile, ScanStatus, Trigger } from "@/fixtures/types";

// ─── Repositories ─────────────────────────────────────────────────────────────

function mapScanStatus(s: string): ScanStatus {
  const map: Record<string, ScanStatus> = {
    QUEUED: "Queued",
    RUNNING: "Running",
    COMPLETED: "Completed",
    FAILED: "Failed",
  };
  return map[s] ?? "Queued";
}

function mapCriticality(c: string): Repository["criticality"] {
  const map: Record<string, Repository["criticality"]> = {
    CRITICAL: "Critical",
    HIGH: "High",
    MEDIUM: "Medium",
    LOW: "Low",
  };
  return map[c] ?? "Medium";
}

export async function getRepositories(): Promise<Repository[]> {
  const repos = await prisma.repository.findMany({
    include: {
      scans: {
        orderBy: { startedAt: "desc" },
        take: 1,
        select: { status: true, startedAt: true, commitSha: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return repos.map((r) => {
    const lastScan = r.scans[0];
    return {
      id: r.id,
      fullName: r.fullName,
      owner: r.owner,
      name: r.name,
      defaultBranch: r.defaultBranch,
      lastCommitSha: lastScan?.commitSha ?? "unknown",
      language: r.language ?? "Unknown",
      connectedAt: r.createdAt.toISOString(),
      scanEnabled: r.scanEnabled,
      dataLifetimeYears: r.dataLifetimeYears,
      criticality: mapCriticality(r.criticality),
      lastScanAt: lastScan?.startedAt.toISOString() ?? null,
      lastScanStatus: lastScan ? mapScanStatus(lastScan.status) : null,
    };
  });
}

// ─── Scans ────────────────────────────────────────────────────────────────────

export interface ScansPageParams {
  page?: number;
  pageSize?: number;
  status?: string;
  repositoryId?: string;
}

export interface ScansPage {
  items: Scan[];
  total: number;
}

export async function getScansPage({
  page = 1,
  pageSize = 10,
  status,
  repositoryId,
}: ScansPageParams = {}): Promise<ScansPage> {
  const where = {
    ...(status ? { status: status as "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" } : {}),
    ...(repositoryId ? { repositoryId } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.scan.findMany({
      where,
      include: {
        repository: { select: { fullName: true } },
        profile: { select: { name: true } },
      },
      orderBy: { startedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.scan.count({ where }),
  ]);

  return {
    total,
    items: items.map((s) => ({
      id: s.id,
      repositoryId: s.repositoryId,
      repositoryFullName: s.repository.fullName,
      trigger: s.trigger as Trigger,
      status: mapScanStatus(s.status),
      commitSha: s.commitSha,
      ref: s.ref,
      durationMs: s.durationMs,
      filesScanned: s.filesScanned,
      startedAt: s.startedAt.toISOString(),
      completedAt: s.completedAt?.toISOString() ?? null,
      profileName: s.profile?.name ?? "Default Full Scan",
    })),
  };
}

// ─── ScanProfiles ─────────────────────────────────────────────────────────────

export async function getScanProfiles(): Promise<ScanProfile[]> {
  const profiles = await prisma.scanProfile.findMany({
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  return profiles.map((p) => ({
    id: p.id,
    name: p.name,
    rulePackIds: p.rulePackIds,
    includeGlobs: p.includeGlobs,
    excludeGlobs: p.excludeGlobs,
    maxFileSizeKb: p.maxFileSizeKb,
    createdAt: p.createdAt.toISOString(),
    isDefault: p.isDefault,
  }));
}

// ─── Scan logs ────────────────────────────────────────────────────────────────

export async function getScanLogs(scanId: string) {
  return prisma.scanLog.findMany({
    where: { scanId },
    orderBy: { ts: "asc" },
    select: { id: true, ts: true, level: true, message: true },
  });
}
