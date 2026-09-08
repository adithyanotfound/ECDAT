/**
 * GET /api/scans/[id]/logs/stream
 * Server-Sent Events endpoint — streams scan logs in real time.
 * Polls DB every 1.5s, sends new rows as SSE events, closes on scan completion.
 *
 * Client usage:
 *   const es = new EventSource(`/api/scans/${scanId}/logs/stream`)
 *   es.onmessage = (e) => console.log(JSON.parse(e.data))
 *   es.addEventListener('done', () => es.close())
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/server/db/client";

const POLL_MS = 1_500;
const TIMEOUT_MS = 10 * 60 * 1_000; // max 10 minutes streaming

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: scanId } = await params;

  const encoder = new TextEncoder();
  let lastLogId: string | undefined = undefined;
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const deadline = Date.now() + TIMEOUT_MS;

      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      // Send initial heartbeat so the client knows the connection is alive
      send("heartbeat", { ts: new Date().toISOString() });

      while (!closed && Date.now() < deadline) {
        // Fetch new log rows since last seen
        const newLogs = await prisma.scanLog.findMany({
          where: {
            scanId,
            ...(lastLogId ? { id: { gt: lastLogId } } : {}),
          },
          orderBy: { ts: "asc" },
          take: 50,
        }).catch(() => []);

        for (const log of newLogs) {
          send("log", { id: log.id, ts: log.ts, level: log.level, message: log.message });
          lastLogId = log.id;
        }

        // Check if scan is done
        const scan = await prisma.scan.findUnique({
          where: { id: scanId },
          select: { status: true },
        }).catch(() => null);

        if (scan?.status === "COMPLETED" || scan?.status === "FAILED") {
          send("done", { status: scan.status });
          closed = true;
          controller.close();
          return;
        }

        await new Promise((r) => setTimeout(r, POLL_MS));
      }

      // Timeout
      send("timeout", { message: "Stream timed out after 10 minutes" });
      controller.close();
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // disable nginx buffering
    },
  });
}
