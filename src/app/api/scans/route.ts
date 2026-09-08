import { NextRequest, NextResponse } from "next/server";
import { getScansPage } from "@/server/db/scanning";
import { scans as fixtureScans } from "@/fixtures/scans";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const page = Number(searchParams.get("page") ?? 1);
  const pageSize = Number(searchParams.get("pageSize") ?? 10);
  const status = searchParams.get("status") ?? undefined;

  try {
    const data = await getScansPage({ page, pageSize, status });
    return NextResponse.json(data);
  } catch {
    const start = (page - 1) * pageSize;
    const items = fixtureScans.slice(start, start + pageSize);
    return NextResponse.json({ items, total: fixtureScans.length });
  }
}
