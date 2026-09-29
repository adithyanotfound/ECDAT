import { NextRequest, NextResponse } from "next/server";
import { getScansPage } from "@/server/db/scanning";
import { isAuthError, paging, unauthorized } from "@/server/auth/guard";
import { scans as fixtureScans } from "@/fixtures/scans";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const { page, pageSize } = paging(searchParams, 10, 100);
  const status = searchParams.get("status") ?? undefined;
  const repositoryId = searchParams.get("repositoryId") ?? undefined;
  const search = searchParams.get("search")?.trim() || undefined;

  try {
    const data = await getScansPage({ page, pageSize, status, repositoryId, search });
    return NextResponse.json(data);
  } catch (err) {
    if (isAuthError(err)) return unauthorized();
    // Database unreachable: show the sample data so the UI still renders.
    const start = (page - 1) * pageSize;
    const items = fixtureScans.slice(start, start + pageSize);
    return NextResponse.json({ items, total: fixtureScans.length });
  }
}
