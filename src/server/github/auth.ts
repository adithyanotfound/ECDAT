/**
 * GitHub App authentication helpers.
 * Mint short-lived installation tokens per-job — never cache across job boundaries.
 *
 * Required env vars:
 *   GITHUB_APP_ID          — numeric App ID from GitHub App settings
 *   GITHUB_APP_PRIVATE_KEY — PEM private key (newlines replaced with \n in env)
 *   GITHUB_CLIENT_ID       — App's OAuth client_id
 *   GITHUB_CLIENT_SECRET   — App's OAuth client_secret
 *   GITHUB_WEBHOOK_SECRET  — used to verify X-Hub-Signature-256
 */
import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";

function getPrivateKey(): string {
  const raw = process.env.GITHUB_APP_PRIVATE_KEY ?? "";
  // GitHub often stores the PEM with literal \n characters in env
  return raw.replace(/\\n/g, "\n");
}

function getAppId(): number {
  const id = process.env.GITHUB_APP_ID;
  if (!id) throw new Error("GITHUB_APP_ID is not set");
  return Number(id);
}

/**
 * Returns an Octokit instance authenticated as the App itself
 * (for listing installations, etc.)
 */
export function getAppOctokit(): Octokit {
  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: getAppId(),
      privateKey: getPrivateKey(),
    },
  });
}

/**
 * Returns an Octokit instance authenticated as a specific installation.
 * Mint per-job — tokens expire after 1 hour.
 */
export async function getInstallationOctokit(
  installationId: number
): Promise<Octokit> {
  const auth = createAppAuth({
    appId: getAppId(),
    privateKey: getPrivateKey(),
  });
  const { token } = await auth({
    type: "installation",
    installationId,
  });
  return new Octokit({ auth: token });
}

/**
 * Returns a raw installation token string (for streaming the tarball
 * using the GitHub API with Authorization header).
 */
export async function getInstallationToken(
  installationId: number
): Promise<string> {
  const auth = createAppAuth({
    appId: getAppId(),
    privateKey: getPrivateKey(),
  });
  const { token } = await auth({
    type: "installation",
    installationId,
  });
  return token;
}
