import { NextRequest, NextResponse } from "next/server";
import { getInventoryPage } from "@/server/db/assets";
import { inventoryAssets as fixtureInventory } from "@/fixtures/assets";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const page = Number(searchParams.get("page") ?? 1);
  const pageSize = Number(searchParams.get("pageSize") ?? 10);
  const search = searchParams.get("search") ?? undefined;

  try {
    const data = await getInventoryPage({ page, pageSize, search });
    return NextResponse.json(data);
  } catch {
    const filtered = search
      ? fixtureInventory.filter((a) =>
          a.ipHostname.toLowerCase().includes(search.toLowerCase()) ||
          a.assetId.toLowerCase().includes(search.toLowerCase())
        )
      : fixtureInventory;
    const start = (page - 1) * pageSize;
    return NextResponse.json({
      items: filtered.slice(start, start + pageSize),
      total: filtered.length,
      totalAssets: 60,
      classifiedAssets: 50,
      monitoredAssets: 40,
      newAssets: 15,
    });
  }
}
