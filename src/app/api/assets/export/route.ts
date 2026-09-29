/**
 * GET /api/assets/export
 * JSON inventory export — the signed-in user's full cryptographic asset
 * catalogue for offline review (IMPLEMENTATION_PLAN.md §Phase 5 "Reports and exports").
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/client";
import { sessionOr401 } from "@/server/auth/guard";

const KINDS = ["ALGORITHM", "CERTIFICATE", "KEY", "PROTOCOL", "LIBRARY", "SECRET"] as const;

export async function GET(req: NextRequest) {
  const session = await sessionOr401();
  if (session instanceof NextResponse) return session;

  const { searchParams } = req.nextUrl;
  const repositoryId = searchParams.get("repositoryId") ?? undefined;
  const kind = KINDS.find((k) => k === searchParams.get("kind")?.toUpperCase());

  const assets = await prisma.cryptoAsset.findMany({
    where: {
      repository: { owner: session.login },
      ...(repositoryId ? { repositoryId } : {}),
      ...(kind ? { kind } : {}),
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

  return new NextResponse(
    JSON.stringify({ exportedAt: new Date().toISOString(), count: inventory.length, assets: inventory }, null, 2),
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="vajra-inventory-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    },
  );
}
