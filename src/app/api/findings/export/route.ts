/**
 * GET /api/findings/export
 * Findings CSV export for the signed-in user's repositories
 * (IMPLEMENTATION_PLAN.md §Phase 5 "Reports and exports").
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/client";
import { sessionOr401 } from "@/server/auth/guard";

const SEVERITIES = ["CRITICAL", "HIGH", "MODERATE", "LOW", "COMPLIANT"] as const;
const STATUSES = ["OPEN", "MITIGATED", "ACCEPTED"] as const;

function csvEscape(value: unknown): string {
  let s = String(value ?? "");
  // Neutralise spreadsheet formulas: a cell starting with = + - @ would run in Excel.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: NextRequest) {
  const session = await sessionOr401();
  if (session instanceof NextResponse) return session;

  const { searchParams } = req.nextUrl;
  const repositoryId = searchParams.get("repositoryId") ?? undefined;
  const severity = SEVERITIES.find((s) => s === searchParams.get("severity")?.toUpperCase());
  const status = STATUSES.find((s) => s === searchParams.get("status")?.toUpperCase());

  const findings = await prisma.finding.findMany({
    where: {
      repository: { owner: session.login },
      ...(repositoryId ? { repositoryId } : {}),
      ...(severity ? { severity } : {}),
      ...(status ? { status } : {}),
    },
    include: { repository: { select: { fullName: true } } },
    orderBy: [{ severity: "asc" }, { lastSeenAt: "desc" }],
    take: 5000,
  });

  const header = [
    "code",
    "repository",
    "severity",
    "status",
    "title",
    "detail",
    "affectedComponent",
    "filePath",
    "lineNumber",
    "cweId",
    "nistRef",
    "firstSeenAt",
    "lastSeenAt",
  ];
  const rows = findings.map((f) => [
    f.code,
    f.repository.fullName,
    f.severity,
    f.status,
    f.title,
    f.detail,
    f.affectedComponent ?? "",
    f.filePath ?? "",
    f.lineNumber ?? "",
    f.cweId ?? "",
    f.nistRef ?? "",
    f.firstSeenAt.toISOString(),
    f.lastSeenAt.toISOString(),
  ]);

  const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ecdat-findings-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
