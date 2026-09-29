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
// Vercel ends a response at maxDuration; the log drawer then offers to reopen.
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/client";
import { ownedScanOr404, sessionOr401 } from "@/server/auth/guard";

const POLL_MS = 1_500;
// Max streaming time: 10 minutes self-hosted; on Vercel, end cleanly before maxDuration cuts it off.
const TIMEOUT_MS = process.env.VERCEL ? 280_000 : 10 * 60 * 1_000;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await sessionOr401();
  if (session instanceof NextResponse) return session;

  const { id: scanId } = await params;
  const owned = await ownedScanOr404(session, scanId).catch(() => null);
  if (!owned) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  if (owned instanceof NextResponse) return owned;

  const encoder = new TextEncoder();
  let lastLogId: string | undefined = undefined;
  let closed = false;

  // Stop polling the database as soon as the browser goes away.
  req.signal.addEventListener("abort", () => {
    closed = true;
  });

  const stream = new ReadableStream({
    async start(controller) {
      const deadline = Date.now() + TIMEOUT_MS;

      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      // Send initial heartbeat so the client knows the connection is alive
      send("heartbeat", { ts: new Date().toISOString() });

      while (!closed && Date.now() < deadline) {
        // Fetch new log rows since last seen
        const newLogs = await prisma.scanLog
          .findMany({
            where: {
              scanId,
              ...(lastLogId ? { id: { gt: lastLogId } } : {}),
            },
            orderBy: { ts: "asc" },
            take: 50,
          })
          .catch(() => []);

        for (const log of newLogs) {
          send("log", { id: log.id, ts: log.ts, level: log.level, message: log.message });
          lastLogId = log.id;
        }

        // Check if scan is done
        const scan = await prisma.scan
          .findUnique({
            where: { id: scanId },
            select: { status: true, errorMessage: true },
          })
          .catch(() => null);

        if (scan?.status === "COMPLETED" || scan?.status === "FAILED") {
          send("done", { status: scan.status, errorMessage: scan.errorMessage });
          closed = true;
          controller.close();
          return;
        }

        await new Promise((r) => setTimeout(r, POLL_MS));
      }

      if (closed) return;
      // Timeout
      send("timeout", { message: "Live stream closed; reopen to continue" });
      closed = true;
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
