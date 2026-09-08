import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/client";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const scan = await prisma.scan.findUnique({
      where: { id },
      include: {
        repository: { select: { fullName: true, owner: true, name: true } },
        logs: { orderBy: { ts: "asc" }, take: 500 },
        profile: { select: { name: true } },
      },
    });
    if (!scan) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(scan);
  } catch {
    return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  }
}
