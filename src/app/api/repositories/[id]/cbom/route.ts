/**
 * GET /api/repositories/[id]/cbom
 * Returns the CycloneDX 1.6 CBOM from the repository's most recent completed
 * scan. Pass ?download=1 to get it as an attachment (the CBOM report page's
 * "Download CBOM" button).
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/client";
import { ownedRepositoryOr404, safeFilename, sessionOr401 } from "@/server/auth/guard";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await sessionOr401();
  if (session instanceof NextResponse) return session;

  const { id: repositoryId } = await params;
  const download = req.nextUrl.searchParams.get("download");

  const repo = await ownedRepositoryOr404(session, repositoryId);
  if (repo instanceof NextResponse) return repo;

  const scan = await prisma.scan.findFirst({
    where: { repositoryId, status: "COMPLETED", cbom: { isNot: null } },
    orderBy: { completedAt: "desc" },
    include: { cbom: true },
  });

  if (!scan?.cbom) {
    return NextResponse.json({ error: "No CBOM yet. Run a scan on this repository first." }, { status: 404 });
  }

  if (download) {
    return new NextResponse(JSON.stringify(scan.cbom.json, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeFilename(repo.fullName)}-cbom.json"`,
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
