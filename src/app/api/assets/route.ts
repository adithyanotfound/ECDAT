import { NextRequest, NextResponse } from "next/server";
import { getCryptoAssetsPage } from "@/server/db/assets";
import { cryptoAssets as fixtureAssets } from "@/fixtures/assets";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const page = Number(searchParams.get("page") ?? 1);
  const pageSize = Number(searchParams.get("pageSize") ?? 20);
  const search = searchParams.get("search") ?? undefined;
  const kind = searchParams.get("kind") ?? undefined;
  const sort = searchParams.get("sort") ?? "crsfScore";
  const dir = (searchParams.get("dir") ?? "desc") as "asc" | "desc";

  try {
    const data = await getCryptoAssetsPage({ page, pageSize, search, kind, sort, dir });
    return NextResponse.json(data);
  } catch {
    const filtered = kind
      ? fixtureAssets.filter((a) => a.kind.toUpperCase() === kind)
      : fixtureAssets;
    const start = (page - 1) * pageSize;
    return NextResponse.json({
      items: filtered.slice(start, start + pageSize),
      total: filtered.length,
    });
  }
}
