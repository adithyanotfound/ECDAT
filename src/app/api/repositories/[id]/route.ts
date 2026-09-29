/**
 * DELETE /api/repositories/[id]
 * Deletes one of the signed-in user's repositories and everything found in it.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/client";
import { ownedRepositoryOr404, sessionOr401 } from "@/server/auth/guard";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await sessionOr401();
  if (session instanceof NextResponse) return session;

  const { id } = await params;

  try {
    const repo = await ownedRepositoryOr404(session, id);
    if (repo instanceof NextResponse) return repo;

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
    console.error("[delete-repo] error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Failed to delete repository" }, { status: 500 });
  }
}
