/**
 * GET /api/repositories/[id]/cbom
 * Returns the CycloneDX 1.6 CBOM from the repository's most recent completed
 * scan. Pass ?download=1 to get it as an attachment (the CBOM report page's
 * "Download CBOM" button).
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/client";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: repositoryId } = await params;
  const download = req.nextUrl.searchParams.get("download");

  const repo = await prisma.repository.findUnique({
    where: { id: repositoryId },
    select: { fullName: true },
  });
  if (!repo) return NextResponse.json({ error: "Repository not found" }, { status: 404 });

  const scan = await prisma.scan.findFirst({
    where: { repositoryId, status: "COMPLETED", cbom: { isNot: null } },
    orderBy: { completedAt: "desc" },
    include: { cbom: true },
  });

  if (!scan?.cbom) {
    return NextResponse.json({ error: "No CBOM available yet — run a scan first" }, { status: 404 });
  }

  if (download) {
    return new NextResponse(JSON.stringify(scan.cbom.json, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${repo.fullName.replace("/", "-")}-cbom.json"`,
      },
    });
  }

  return NextResponse.json({
    scanId: scan.id,
    repositoryFullName: repo.fullName,
    commitSha: scan.commitSha,
    completedAt: scan.completedAt,
    cbom: scan.cbom.json,
  });
}
