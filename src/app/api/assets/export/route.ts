/**
 * GET /api/assets/export
 * JSON inventory export — the full cryptographic asset catalogue for
 * offline review (IMPLEMENTATION_PLAN.md §Phase 5 "Reports and exports").
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/client";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const repositoryId = searchParams.get("repositoryId") ?? undefined;
  const kind = searchParams.get("kind") ?? undefined;

  const assets = await prisma.cryptoAsset.findMany({
    where: {
      ...(repositoryId ? { repositoryId } : {}),
      ...(kind ? { kind: kind as "ALGORITHM" } : {}),
    },
    include: {
      repository: { select: { fullName: true } },
      riskAssessment: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 10000,
  });

  const inventory = assets.map((a) => ({
    id: a.id,
    repository: a.repository.fullName,
    kind: a.kind,
    name: a.name,
    primitive: a.primitive,
    algorithm: a.algorithm,
    keyLengthBits: a.keyLengthBits,
    mode: a.mode,
    padding: a.padding,
    curve: a.curve,
    quantumSafe: a.quantumSafe,
    nistQuantumLevel: a.nistQuantumLevel,
    executionEnvironment: a.executionEnvironment,
    filePath: a.filePath,
    lineNumber: a.lineNumber,
    usageCount: a.usageCount,
    ruleId: a.ruleId,
    crsfScore: a.riskAssessment?.crsfScore ?? null,
    cisScore: a.riskAssessment?.cisScore ?? null,
    pqcSafetyScore: a.riskAssessment?.pqcSafetyScore ?? null,
    riskCategory: a.riskAssessment?.riskCategory ?? null,
    firstSeenScanId: a.firstSeenScanId,
    lastSeenScanId: a.lastSeenScanId,
    updatedAt: a.updatedAt.toISOString(),
  }));

  return new NextResponse(JSON.stringify({ exportedAt: new Date().toISOString(), count: inventory.length, assets: inventory }, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="ecdat-inventory-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
