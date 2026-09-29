/**
 * DELETE /api/repositories/[id]
 * Deletes a repository and all its associated assets, findings, and scans.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/client";
import { requireSession } from "@/server/auth/session";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const repo = await prisma.repository.findUnique({ where: { id } });
    if (!repo) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Cascade delete in a transaction to satisfy foreign key constraints
    await prisma.$transaction([
      prisma.scanLog.deleteMany({ where: { scan: { repositoryId: id } } }),
      prisma.cbom.deleteMany({ where: { scan: { repositoryId: id } } }),
      prisma.findingAsset.deleteMany({ where: { finding: { repositoryId: id } } }),
      prisma.riskAssessment.deleteMany({ where: { cryptoAsset: { repositoryId: id } } }),
      prisma.finding.deleteMany({ where: { repositoryId: id } }),
      prisma.cryptoAsset.deleteMany({ where: { repositoryId: id } }),
      prisma.recommendation.deleteMany({ where: { repositoryId: id } }),
      prisma.scan.deleteMany({ where: { repositoryId: id } }),
      prisma.repository.delete({ where: { id } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[delete-repo] error:", err);
    return NextResponse.json({ error: "Failed to delete repository" }, { status: 500 });
  }
}
