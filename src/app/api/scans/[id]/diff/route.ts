/**
 * GET /api/scans/[id]/diff
 * The change-diff for a scan vs. the previous completed scan of the same
 * repository — see src/server/db/diff.ts.
 */
import { NextRequest, NextResponse } from "next/server";
import { getScanDiff } from "@/server/db/diff";
import { ownedScanOr404, sessionOr401 } from "@/server/auth/guard";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await sessionOr401();
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  try {
    const owned = await ownedScanOr404(session, id);
    if (owned instanceof NextResponse) return owned;

    const diff = await getScanDiff(id);
    return NextResponse.json(diff);
  } catch (err) {
    console.error("[scan-diff] error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
