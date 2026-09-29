/**
 * POST /api/github/webhook
 *
 * WARNING — read the raw body FIRST, verify the HMAC, then parse JSON.
 * Re-serialising a parsed object produces different bytes → every check fails.
 * (See IMPLEMENTATION_PLAN.md §"The four things that break here")
 *
 * export const runtime = "nodejs" is REQUIRED — Edge runtime does not have
 * the full crypto API and cannot read a streaming request body reliably.
 */
export const runtime = "nodejs";
// On Vercel, scans queued by a push run in this invocation after the 202 (see runJobsSoon).
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/client";
import { verifyWebhookSignature } from "@/server/github/webhook";
import { enqueueJob } from "@/server/jobs/queue";
import { isRateLimited } from "@/server/security/rateLimit";
import { runJobsSoon } from "@/server/jobs/kick";

// GitHub's own webhook delivery volume from a single App install is bursty
// but bounded — this ceiling is generous for legitimate traffic and cheap
// insurance against a flood (spoofed or not) tying up the job queue.
const WEBHOOK_RATE_LIMIT = 60;
const WEBHOOK_RATE_WINDOW_MS = 60_000;

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(`webhook:${ip}`, WEBHOOK_RATE_LIMIT, WEBHOOK_RATE_WINDOW_MS)) {
    console.warn(`[webhook] rate limit exceeded for ${ip}`);
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // 1. Read raw body — must happen before any JSON.parse
  const rawBody = await req.text();

  // 2. Verify HMAC-SHA256 signature
  const signature = req.headers.get("x-hub-signature-256");
  const valid = await verifyWebhookSignature(rawBody, signature);
  if (!valid) {
    console.warn("[webhook] invalid signature");
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 3. Idempotency — dedupe by X-GitHub-Delivery ID
  const deliveryId = req.headers.get("x-github-delivery") ?? "";
  const event = req.headers.get("x-github-event") ?? "";

  try {
    await prisma.webhookDelivery.create({
      data: { deliveryId, event, payload: JSON.parse(rawBody) },
    });
  } catch {
    // Unique constraint violation → already processed, silently skip
    console.log(`[webhook] duplicate delivery ${deliveryId}, skipping`);
    return NextResponse.json({ ok: true, duplicate: true });
  }

  // 4. Parse payload and dispatch
  const payload = JSON.parse(rawBody);

  try {
    if (event === "push") {
      await handlePush(payload);
    } else if (event === "installation") {
      await handleInstallation(payload);
    } else if (event === "installation_repositories") {
      await handleInstallationRepositories(payload);
    } else {
      console.log(`[webhook] unhandled event: ${event}`);
    }
  } catch (err) {
    // Message only — never the raw error, which can carry a live
    // installation token on an Octokit error's `.request` property.
    console.error(`[webhook] handler error for ${event}:`, err instanceof Error ? err.message : String(err));
    // Still return 200 to prevent GitHub from retrying with duplicate delivery IDs
  }

  // Serverless hosts have no polling worker: run anything just queued after responding.
  runJobsSoon();

  // 5. Return 202 immediately — never block on slow processing
  return NextResponse.json({ ok: true }, { status: 202 });
}

// ─── Event handlers ───────────────────────────────────────────────────────────

async function handlePush(payload: {
  ref: string;
  after: string;
  installation?: { id: number };
  repository: { id: number; full_name: string; owner: { login: string }; name: string };
}) {
  const installationId = payload.installation?.id ?? 0;

  // Only scan default branch pushes (avoid PR branches for initial implementation)
  const { ref, after: commitSha, repository } = payload;
  if (!ref.startsWith("refs/heads/")) return;

  // Find the repository in our DB
  let repo = await prisma.repository.findFirst({
    where: { githubRepoId: repository.id },
    select: { id: true, scanEnabled: true, owner: true, name: true, fullName: true },
  });

  if (!repo) {
    // Fallback for manually added repositories
    repo = await prisma.repository.findUnique({
      where: { fullName: repository.full_name },
      select: { id: true, scanEnabled: true, owner: true, name: true, fullName: true },
    });
  }
  if (!repo || !repo.scanEnabled) return;

  // Create scan row + enqueue
  const scan = await prisma.scan.create({
    data: {
      repositoryId: repo.id,
      trigger: "PUSH",
      status: "QUEUED",
      commitSha: commitSha.slice(0, 7),
      ref,
    },
  });

  await enqueueJob("PUSH_SCAN", {
    scanId: scan.id,
    repositoryId: repo.id,
    installationId,
    owner: repo.owner === "admin" ? repo.fullName.split("/")[0] : repo.owner,
    repo: repo.name,
    ref,
    commitSha: commitSha.slice(0, 7),
  });

  console.log(`[webhook] push → queued scan ${scan.id} for ${repository.full_name}`);
}

async function handleInstallation(payload: {
  action: string;
  installation: {
    id: number;
    account?: { login: string; type?: string; avatar_url?: string };
  };
  repositories?: Array<{ id: number; full_name: string; name: string; private: boolean }>;
}) {
  const { action, installation } = payload;
  const githubInstallationId = installation.id;

  if (action === "deleted" || action === "suspend") {
    await prisma.installation.updateMany({
      where: { githubInstallationId },
      data: { suspendedAt: new Date() },
    });
    await prisma.repository.updateMany({
      where: { installation: { githubInstallationId } },
      data: { scanEnabled: false },
    });
    console.log(`[webhook] installation ${githubInstallationId} ${action}`);
  } else if (action === "unsuspend") {
    await prisma.installation.updateMany({
      where: { githubInstallationId },
      data: { suspendedAt: null },
    });
    await prisma.repository.updateMany({
      where: { installation: { githubInstallationId } },
      data: { scanEnabled: true },
    });
  } else if (action === "created") {
    const { account } = installation;
    const inst = await prisma.installation.upsert({
      where: { githubInstallationId },
      create: {
        githubInstallationId,
        accountLogin: account?.login ?? "unknown",
        accountType: account?.type ?? "User",
        avatarUrl: account?.avatar_url ?? null,
      },
      update: {
        accountLogin: account?.login ?? "unknown",
        avatarUrl: account?.avatar_url ?? null,
        suspendedAt: null,
      },
    });

    if (payload.repositories) {
      for (const ghRepo of payload.repositories) {
        const [owner] = ghRepo.full_name.split("/");
        const repo = await prisma.repository.upsert({
          where: { githubRepoId: ghRepo.id },
          create: {
            installationId: inst.id,
            githubRepoId: ghRepo.id,
            fullName: ghRepo.full_name,
            owner,
            name: ghRepo.name,
            defaultBranch: "main",
            isPrivate: ghRepo.private,
            scanEnabled: true,
          },
          update: { scanEnabled: true },
        });

        const scan = await prisma.scan.create({
          data: {
            repositoryId: repo.id,
            trigger: "INITIAL",
            status: "QUEUED",
            commitSha: "unknown",
            ref: "refs/heads/main",
          },
        });

        await enqueueJob("INITIAL_SCAN", {
          scanId: scan.id,
          repositoryId: repo.id,
          installationId: githubInstallationId,
          owner,
          repo: ghRepo.name,
          ref: "refs/heads/main",
          commitSha: "unknown",
        });
      }
    }
  }
}

async function handleInstallationRepositories(payload: {
  action: string;
  installation: { id: number };
  repositories_added?: Array<{ id: number; full_name: string; name: string; private: boolean }>;
  repositories_removed?: Array<{ id: number }>;
}) {
  const { action, installation, repositories_added, repositories_removed } = payload;
  const githubInstallationId = installation.id;

  const inst = await prisma.installation.findUnique({
    where: { githubInstallationId },
    select: { id: true },
  });
  if (!inst) return;

  if (action === "added" && repositories_added) {
    for (const ghRepo of repositories_added) {
      const [owner] = ghRepo.full_name.split("/");
      const repo = await prisma.repository.upsert({
        where: { githubRepoId: ghRepo.id },
        create: {
          installationId: inst.id,
          githubRepoId: ghRepo.id,
          fullName: ghRepo.full_name,
          owner,
          name: ghRepo.name,
          defaultBranch: "main",
          isPrivate: ghRepo.private,
          scanEnabled: true,
        },
        update: { scanEnabled: true },
      });

      const scan = await prisma.scan.create({
        data: {
          repositoryId: repo.id,
          trigger: "INITIAL",
          status: "QUEUED",
          commitSha: "unknown",
          ref: "refs/heads/main",
        },
      });

      await enqueueJob("INITIAL_SCAN", {
        scanId: scan.id,
        repositoryId: repo.id,
        installationId: githubInstallationId,
        owner,
        repo: ghRepo.name,
        ref: "refs/heads/main",
        commitSha: "unknown",
      });
    }
  }

  if (action === "removed" && repositories_removed) {
    for (const r of repositories_removed) {
      await prisma.repository.updateMany({
        where: { githubRepoId: r.id },
        data: { scanEnabled: false },
      });
    }
  }
}
