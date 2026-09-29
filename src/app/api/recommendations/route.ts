import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/client";
import { paging, sessionOr401 } from "@/server/auth/guard";

const EFFORTS = ["HIGH", "MEDIUM", "LOW"];
const EFFORT_ORDER: Record<string, number> = { HIGH: 1, MEDIUM: 2, LOW: 3 };

export async function GET(req: NextRequest) {
  const session = await sessionOr401();
  if (session instanceof NextResponse) return session;

  const { searchParams } = req.nextUrl;
  const { page, pageSize } = paging(searchParams, 10, 100);
  const search = searchParams.get("search")?.trim() || undefined;
  const effortParam = searchParams.get("effort")?.toUpperCase();
  const effort = effortParam && EFFORTS.includes(effortParam) ? effortParam : undefined;
  const sort = searchParams.get("sort") ?? undefined;
  const repositoryId = searchParams.get("repositoryId") ?? undefined;

  // Everything below is limited to the signed-in user's repositories.
  const scope = { repository: { owner: session.login }, ...(repositoryId ? { repositoryId } : {}) };
  const where = {
    ...scope,
    ...(effort ? { effort } : {}),
    ...(search
      ? {
          OR: [
            { fromAlgorithm: { contains: search, mode: "insensitive" as const } },
            { toAlgorithm: { contains: search, mode: "insensitive" as const } },
            { repository: { owner: session.login, fullName: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  try {
    const [rawItems, total, high, medium, low] = await Promise.all([
      prisma.recommendation.findMany({
        where,
        include: { repository: { select: { fullName: true } } },
        take: 1000,
      }),
      prisma.recommendation.count({ where }),
      prisma.recommendation.count({ where: { ...scope, effort: "HIGH" } }),
      prisma.recommendation.count({ where: { ...scope, effort: "MEDIUM" } }),
      prisma.recommendation.count({ where: { ...scope, effort: "LOW" } }),
    ]);

    const sorted =
      sort === "effort"
        ? [...rawItems].sort((a, b) => (EFFORT_ORDER[a.effort] ?? 4) - (EFFORT_ORDER[b.effort] ?? 4))
        : rawItems;

    const start = (page - 1) * pageSize;
    const items = sorted.slice(start, start + pageSize);

    return NextResponse.json({
      items: items.map((r) => ({
        id: r.id,
        repositoryId: r.repositoryId,
        repositoryFullName: r.repository.fullName,
        fromAlgorithm: r.fromAlgorithm,
        toAlgorithm: r.toAlgorithm,
        standard: r.standard,
        effort: r.effort,
        latencyImpact: r.latencyImpact,
        sizeImpact: r.sizeImpact,
        notes: r.notes,
      })),
      total,
      stats: { total: high + medium + low, high, medium, low },
    });
  } catch (err) {
    console.error("[recommendations] error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ items: [], total: 0, stats: { total: 0, high: 0, medium: 0, low: 0 } });
  }
}
