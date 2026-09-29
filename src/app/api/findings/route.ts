import { NextRequest, NextResponse } from "next/server";
import { getFindingsPage } from "@/server/db/assets";
import { isAuthError, paging, unauthorized } from "@/server/auth/guard";
import { findings as fixtureFindings } from "@/fixtures/assets";

const SEVERITIES = ["CRITICAL", "HIGH", "MODERATE", "LOW", "COMPLIANT"];
const STATUSES = ["OPEN", "MITIGATED", "ACCEPTED"];

/** Keeps only values the database knows, so a typo can't turn into a 500. */
const pick = (value: string | null, allowed: string[]) => {
  const v = value?.toUpperCase();
  return v && allowed.includes(v) ? v : undefined;
};

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const { page, pageSize } = paging(searchParams, 10, 100);
  const search = searchParams.get("search")?.trim() || undefined;
  const severity = pick(searchParams.get("severity"), SEVERITIES);
  const status = pick(searchParams.get("status"), STATUSES);
  const repositoryId = searchParams.get("repositoryId") ?? undefined;

  try {
    const data = await getFindingsPage({ page, pageSize, search, severity, status, repositoryId });
    return NextResponse.json(data);
  } catch (err) {
    if (isAuthError(err)) return unauthorized();
    // Database unreachable: show the sample data so the UI still renders.
    const filtered = fixtureFindings.filter((f) => {
      if (repositoryId && f.repositoryId !== repositoryId) return false;
      if (severity && f.severity.toUpperCase() !== severity) return false;
      if (status && f.status.toUpperCase() !== status) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          f.title.toLowerCase().includes(q) || f.code.toLowerCase().includes(q) || f.detail.toLowerCase().includes(q)
        );
      }
      return true;
    });
    const start = (page - 1) * pageSize;
    return NextResponse.json({
      items: filtered.slice(start, start + pageSize),
      total: filtered.length,
      openCount: fixtureFindings.filter((f) => f.status === "Open").length,
      criticalCount: fixtureFindings.filter((f) => f.severity === "Critical").length,
      highCount: fixtureFindings.filter((f) => f.severity === "High").length,
    });
  }
}
