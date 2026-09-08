/**
 * GET /api/findings/export
 * Findings CSV export (IMPLEMENTATION_PLAN.md §Phase 5 "Reports and exports").
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/client";

function csvEscape(value: unknown): string {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const repositoryId = searchParams.get("repositoryId") ?? undefined;
  const severity = searchParams.get("severity") ?? undefined;
  const status = searchParams.get("status") ?? undefined;

  const findings = await prisma.finding.findMany({
    where: {
      ...(repositoryId ? { repositoryId } : {}),
      ...(severity ? { severity: severity as "CRITICAL" } : {}),
      ...(status ? { status: status as "OPEN" } : {}),
    },
    include: { repository: { select: { fullName: true } } },
    orderBy: [{ severity: "asc" }, { lastSeenAt: "desc" }],
    take: 5000,
  });

  const header = [
    "code", "repository", "severity", "status", "title", "detail",
    "affectedComponent", "filePath", "lineNumber", "cweId", "nistRef",
    "firstSeenAt", "lastSeenAt",
  ];
  const rows = findings.map((f) => [
    f.code, f.repository.fullName, f.severity, f.status, f.title, f.detail,
    f.affectedComponent ?? "", f.filePath ?? "", f.lineNumber ?? "", f.cweId ?? "", f.nistRef ?? "",
    f.firstSeenAt.toISOString(), f.lastSeenAt.toISOString(),
  ]);

  const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ecdat-findings-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
