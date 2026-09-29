import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/client";
import { requireSession } from "@/server/auth/session";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const page = Number(searchParams.get("page") ?? 1);
  const pageSize = Number(searchParams.get("pageSize") ?? 10);
  const search = searchParams.get("search") ?? undefined;
  const effort = searchParams.get("effort") ?? undefined;
  const sort = searchParams.get("sort") ?? undefined;

  const session = await requireSession();
  
  const where = {
    repository: { owner: session.login },
    ...(effort ? { effort: effort.toUpperCase() } : {}),
    ...(search
      ? {
          OR: [
            { fromAlgorithm: { contains: search, mode: "insensitive" as const } },
            { toAlgorithm: { contains: search, mode: "insensitive" as const } },
            { repository: { fullName: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const effortOrder = { "HIGH": 1, "MEDIUM": 2, "LOW": 3 };

  const [rawItems, total] = await Promise.all([
    prisma.recommendation.findMany({
      where,
      include: { repository: { select: { fullName: true } } },
      take: 1000, 
    }),
    prisma.recommendation.count({ where }),
  ]);

  let sorted = rawItems;
  if (sort === "effort") {
    sorted = rawItems.sort((a, b) => {
      const aO = effortOrder[a.effort as keyof typeof effortOrder] ?? 4;
      const bO = effortOrder[b.effort as keyof typeof effortOrder] ?? 4;
      return aO - bO;
    });
  }

  const start = (page - 1) * pageSize;
  const items = sorted.slice(start, start + pageSize);

  const stats = {
    total,
    high: await prisma.recommendation.count({ where: { effort: "HIGH" } }),
    medium: await prisma.recommendation.count({ where: { effort: "MEDIUM" } }),
    low: await prisma.recommendation.count({ where: { effort: "LOW" } }),
  };

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
    stats,
  });
}
