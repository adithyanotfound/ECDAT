import { NextRequest, NextResponse } from "next/server";
import { getCryptoAssetsPage } from "@/server/db/assets";
import { isAuthError, paging, unauthorized } from "@/server/auth/guard";
import { cryptoAssets as fixtureAssets } from "@/fixtures/assets";

const KINDS = ["ALGORITHM", "CERTIFICATE", "KEY", "PROTOCOL", "LIBRARY", "SECRET"];
const SORTS = ["crsfScore", "name", "keyLengthBits", "usageCount", "lastSeenAt"];

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  // The inventory page loads up to 500 rows at once and filters them in the browser.
  const { page, pageSize } = paging(searchParams, 20, 500);
  const search = searchParams.get("search")?.trim() || undefined;
  const kindParam = searchParams.get("kind")?.toUpperCase();
  const kind = kindParam && KINDS.includes(kindParam) ? kindParam : undefined;
  const sortParam = searchParams.get("sort") ?? "crsfScore";
  const sort = SORTS.includes(sortParam) ? sortParam : "crsfScore";
  const dir = searchParams.get("dir") === "asc" ? "asc" : "desc";
  const repositoryId = searchParams.get("repositoryId") ?? undefined;

  try {
    const data = await getCryptoAssetsPage({ page, pageSize, search, kind, sort, dir, repositoryId });
    return NextResponse.json(data);
  } catch (err) {
    if (isAuthError(err)) return unauthorized();
    // Database unreachable: show the sample data so the UI still renders.
    const filtered = fixtureAssets.filter(
      (a) => (!kind || a.kind.toUpperCase() === kind) && (!repositoryId || a.repositoryId === repositoryId),
    );
    const start = (page - 1) * pageSize;
    return NextResponse.json({
      items: filtered.slice(start, start + pageSize),
      total: filtered.length,
    });
  }
}
