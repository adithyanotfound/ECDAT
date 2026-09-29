/**
 * POST /api/github/sync
 * The "Sync with GitHub" button. Finds this App's installations on the
 * signed-in user's GitHub account and brings each one in, exactly as the
 * post-install redirect would have (src/server/github/sync.ts). Recovers
 * from a missed redirect or a webhook that never arrived.
 *
 * Only installations on the user's own account are synced: sessions carry
 * the GitHub login, not organisation memberships.
 */
import { NextResponse } from "next/server";
import { sessionOr401 } from "@/server/auth/guard";
import { isRateLimited } from "@/server/security/rateLimit";
import { installationsForAccount, syncInstallation } from "@/server/github/sync";
import { runJobsSoon } from "@/server/jobs/kick";

// On Vercel the queued scan runs in this invocation after the response (see runJobsSoon).
export const maxDuration = 300;

export async function POST() {
  const session = await sessionOr401();
  if (session instanceof NextResponse) return session;

  if (!process.env.GITHUB_APP_ID || !process.env.GITHUB_APP_PRIVATE_KEY) {
    return NextResponse.json(
      { error: "The GitHub App isn't set up on this server. Set GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY." },
      { status: 503 },
    );
  }

  // Each sync makes several GitHub API calls; a few a minute is plenty.
  if (isRateLimited(`github-sync:${session.login}`, 5, 60_000)) {
    return NextResponse.json({ error: "Syncing too often. Wait a minute and try again." }, { status: 429 });
  }

  try {
    const ids = await installationsForAccount(session.login);
    let repositories = 0;
    let added = 0;
    let scansStarted = 0;
    for (const id of ids) {
      const r = await syncInstallation(id);
      repositories += r.repositories;
      added += r.added;
      scansStarted += r.scansStarted;
    }
    if (scansStarted) runJobsSoon();
    return NextResponse.json({ installations: ids.length, repositories, added, scansStarted });
  } catch (err) {
    // Message only: Octokit errors can carry a live token on `.request`.
    console.error("[github-sync] error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: "GitHub didn't answer as expected. Check the App ID and private key, then try again." },
      { status: 502 },
    );
  }
}
