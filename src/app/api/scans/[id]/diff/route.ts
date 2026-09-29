/**
 * GET /api/scans/[id]/diff
 * The change-diff for a scan vs. the previous completed scan of the same
 * repository — see src/server/db/diff.ts.
 */
import { NextRequest, NextResponse } from "next/server";
import { getScanDiff } from "@/server/db/diff";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const diff = await getScanDiff(id);
    return NextResponse.json(diff);
  } catch (err) {
    console.error("[scan-diff] error:", err);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
