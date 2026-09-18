/**
 * Data-access layer for the Reports screen — Phase 5, Step 7.
 *
 * A "report" is not its own Prisma model (explicitly out of scope for this
 * step) — it is a completed Scan plus the CBOM and Findings that scan
 * produced. This module only reads existing Scan/Cbom/Finding rows.
 */
import { prisma } from "./client";

export interface ReportRow {
  scanId: string;
  repositoryId: string;
  repositoryFullName: string;
  scanDate: string;
  scanStatus: "Completed";
  cbomReady: boolean;
  findingCount: number;
  status: "Ready" | "Pending";
}

export interface ReportsPageParams {
  page?: number;
  pageSize?: number;
}

export interface ReportsPageResult {
  items: ReportRow[];
  total: number;
}

export async function getReportsPage({
  page = 1,
  pageSize = 10,
}: ReportsPageParams = {}): Promise<ReportsPageResult> {
  const where = { status: "COMPLETED" as const };

  const [scans, total] = await Promise.all([
    prisma.scan.findMany({
      where,
      include: {
        repository: { select: { id: true, fullName: true } },
        cbom: { select: { id: true } },
      },
      orderBy: { completedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.scan.count({ where }),
  ]);

  // findingCount = findings this exact scan last (re)confirmed present —
  // i.e. Finding.lastSeenScanId === this scan's id. For a repository's most
  // recent completed scan this is exactly its current finding count; for an
  // older, superseded scan it reflects only what that scan itself observed
  // before later rescans moved lastSeenScanId forward. Real data either way
  // — never fabricated — see the Step 7 summary for this trade-off.
  const findingCounts = await prisma.finding.groupBy({
    by: ["lastSeenScanId"],
    where: { lastSeenScanId: { in: scans.map((s) => s.id) } },
    _count: { lastSeenScanId: true },
  });
  const findingCountByScanId = new Map(findingCounts.map((f) => [f.lastSeenScanId, f._count.lastSeenScanId]));

  const items: ReportRow[] = scans.map((s) => {
    const cbomReady = s.cbom != null;
    return {
      scanId: s.id,
      repositoryId: s.repository.id,
      repositoryFullName: s.repository.fullName,
      scanDate: (s.completedAt ?? s.startedAt).toISOString(),
      scanStatus: "Completed",
      cbomReady,
      findingCount: findingCountByScanId.get(s.id) ?? 0,
      status: cbomReady ? "Ready" : "Pending",
    };
  });

  return { items, total };
}
