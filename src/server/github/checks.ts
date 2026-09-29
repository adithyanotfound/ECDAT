/**
 * Optional GitHub Check Run posting the scan verdict onto the commit —
 * "pushing a weak cipher and watching the check go red is the strongest
 * thirty seconds of any demo" (IMPLEMENTATION_PLAN.md §Phase 5).
 *
 * Requires the App to have the `Checks: Write` permission (§Phase 3 "App
 * registration"). Failure to post a check run must never fail the scan
 * itself — this is best-effort UX, not the source of truth.
 */
import { getInstallationOctokit } from "./auth";

export interface CheckRunSummary {
  owner: string;
  repo: string;
  commitSha: string;
  installationId: number;
  newCriticalCount: number;
  newHighCount: number;
  totalAssets: number;
  quantumVulnerableCount: number;
}

export async function postScanCheckRun(summary: CheckRunSummary): Promise<void> {
  try {
    const octokit = await getInstallationOctokit(summary.installationId);
    const failing = summary.newCriticalCount > 0;
    const neutral = !failing && summary.newHighCount > 0;

    await octokit.rest.checks.create({
      owner: summary.owner,
      repo: summary.repo,
      name: "ECDAT Atlas — Cryptographic Scan",
      head_sha: summary.commitSha,
      status: "completed",
      conclusion: failing ? "failure" : neutral ? "neutral" : "success",
      output: {
        title: failing
          ? `${summary.newCriticalCount} critical cryptographic finding(s) introduced`
          : neutral
          ? `${summary.newHighCount} high-severity finding(s) introduced`
          : "No new critical or high-severity cryptographic findings",
        summary: [
          `**Cryptographic assets discovered:** ${summary.totalAssets}`,
          `**Quantum-vulnerable assets:** ${summary.quantumVulnerableCount}`,
          `**New critical findings:** ${summary.newCriticalCount}`,
          `**New high findings:** ${summary.newHighCount}`,
          "",
          "See the ECDAT Atlas dashboard for the full inventory and PQC recommendations.",
        ].join("\n"),
      },
    });
  } catch (err) {
    console.error("[checks] failed to post check run (non-fatal):", err instanceof Error ? err.message : err);
  }
}
