/**
 * GET /api/github/setup?installation_id=&setup_action=
 * GitHub redirects here after the user installs (or updates) the App.
 *
 * Records the installation, adds its repositories and queues first scans
 * (see src/server/github/sync.ts, shared with the "Sync with GitHub" button),
 * then redirects to /scanning/repositories.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/client";
import { syncInstallation } from "@/server/github/sync";
import { runJobsSoon } from "@/server/jobs/kick";

// On Vercel the queued scan runs in this invocation after the response (see runJobsSoon).
export const maxDuration = 300;
import { sessionOr401 } from "@/server/auth/guard";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const installationId = Number(searchParams.get("installation_id"));
  const setupAction = searchParams.get("setup_action");

  if (!installationId || isNaN(installationId)) {
    return NextResponse.redirect(
      new URL("/scanning/repositories?error=missing_installation", process.env.NEXT_PUBLIC_APP_URL || req.url),
    );
  }

  // Handle revocation. Install and update redirects stay open, as GitHub sends
  // people here before they've signed in, and every detail is re-read from the
  // GitHub API. Detaching is destructive, so only the installation's own
  // account may do it.
  if (setupAction === "delete") {
    const session = await sessionOr401();
    if (session instanceof NextResponse) return session;
    const owned = await prisma.installation.findFirst({
      where: { githubInstallationId: installationId, accountLogin: session.login },
      select: { id: true },
    });
    if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await prisma.installation.updateMany({
      where: { githubInstallationId: installationId },
      data: { suspendedAt: new Date() },
    });
    await prisma.repository.updateMany({
      where: { installation: { githubInstallationId: installationId } },
      data: { scanEnabled: false },
    });
    return NextResponse.redirect(
      new URL("/scanning/repositories?uninstalled=1", process.env.NEXT_PUBLIC_APP_URL || req.url),
    );
  }

  try {
    await syncInstallation(installationId);
    runJobsSoon();
    return NextResponse.redirect(
      new URL("/scanning/repositories?connected=1", process.env.NEXT_PUBLIC_APP_URL || req.url),
    );
  } catch (err) {
    // Message only — never the raw error, which can carry a live
    // installation token on an Octokit error's `.request` property.
    console.error("[setup] error:", err instanceof Error ? err.message : String(err));
    return NextResponse.redirect(
      new URL("/scanning/repositories?error=setup_failed", process.env.NEXT_PUBLIC_APP_URL || req.url),
    );
  }
}
