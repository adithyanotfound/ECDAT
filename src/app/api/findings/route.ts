import { NextRequest, NextResponse } from "next/server";
import { getFindingsPage } from "@/server/db/assets";
import { findings as fixtureFindings } from "@/fixtures/assets";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const page = Number(searchParams.get("page") ?? 1);
  const pageSize = Number(searchParams.get("pageSize") ?? 10);
  const search = searchParams.get("search") ?? undefined;
  const severity = searchParams.get("severity") ?? undefined;
  const status = searchParams.get("status") ?? undefined;

  try {
    const data = await getFindingsPage({ page, pageSize, search, severity, status });
    return NextResponse.json(data);
  } catch {
    const filtered = fixtureFindings.filter((f) => {
      if (severity && f.severity.toUpperCase() !== severity) return false;
      if (status && f.status.toUpperCase() !== status) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          f.title.toLowerCase().includes(q) ||
          f.code.toLowerCase().includes(q) ||
          f.detail.toLowerCase().includes(q)
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
