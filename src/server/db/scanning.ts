/**
 * Data-access layer for scanning screens (Repositories, Profiles, Scans).
 */
import { prisma } from "./client";
import type { Repository, Scan, ScanStatus, Trigger } from "@/fixtures/types";
import { requireSession } from "@/server/auth/session";

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
  const session = await requireSession();
  const repos = await prisma.repository.findMany({
    where: { owner: session.login },
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
      sourceType: r.sourceType === "AWS" ? "AWS" : "GITHUB",
    };
  });
}

// ─── Scans ────────────────────────────────────────────────────────────────────

const SCAN_STATUSES = ["QUEUED", "RUNNING", "COMPLETED", "FAILED"] as const;

export interface ScansPageParams {
  page?: number;
  pageSize?: number;
  status?: string;
  repositoryId?: string;
  search?: string;
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
  search,
}: ScansPageParams = {}): Promise<ScansPage> {
  const session = await requireSession();
  const statusFilter = SCAN_STATUSES.find((s) => s === status?.toUpperCase());
  const where = {
    repository: {
      owner: session.login,
      ...(search ? { fullName: { contains: search, mode: "insensitive" as const } } : {}),
    },
    ...(statusFilter ? { status: statusFilter } : {}),
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

// ─── Scan logs ────────────────────────────────────────────────────────────────

export async function getScanLogs(scanId: string) {
  return prisma.scanLog.findMany({
    where: { scanId },
    orderBy: { ts: "asc" },
    select: { id: true, ts: true, level: true, message: true },
  });
}
