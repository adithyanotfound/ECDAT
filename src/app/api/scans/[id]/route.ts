import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/client";
import { notFound, sessionOr401 } from "@/server/auth/guard";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await sessionOr401();
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  try {
    const scan = await prisma.scan.findFirst({
      where: { id, repository: { owner: session.login } },
      include: {
        repository: { select: { fullName: true, owner: true, name: true } },
        logs: { orderBy: { ts: "asc" }, take: 500 },
        profile: { select: { name: true } },
      },
    });
    if (!scan) return notFound("Scan not found");
    return NextResponse.json(scan);
  } catch {
    return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  }
}
