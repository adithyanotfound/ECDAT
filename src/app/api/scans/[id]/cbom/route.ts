import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/client";
import { generateAndStoreCbom } from "@/server/cbom/persist";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: scanId } = await params;

  try {
    const existing = await prisma.cbom.findUnique({ where: { scanId } });
    if (existing) {
      return cbomResponse(scanId, existing.json);
    }

    // No stored CBOM yet — supports scans completed before this step
    // existed. Determine why before generating anything.
    const scan = await prisma.scan.findUnique({
      where: { id: scanId },
      select: { status: true },
    });

    if (!scan) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (scan.status !== "COMPLETED") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { cbom } = await generateAndStoreCbom(scanId);
    return cbomResponse(scanId, cbom);
  } catch {
    return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  }
}

function cbomResponse(scanId: string, json: unknown): NextResponse {
  return new NextResponse(JSON.stringify(json), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.cyclonedx+json",
      "Content-Disposition": `attachment; filename="cbom-${scanId}.json"`,
    },
  });
}
