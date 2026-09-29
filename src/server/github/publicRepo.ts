/**
 * Read-only lookups for public GitHub repositories added by name (no GitHub
 * App installation). Uses GitHub's public REST API without credentials, so
 * it's rate-limited (60 requests an hour per server address); callers treat
 * "unavailable" as "couldn't check" rather than as an error.
 */

export type RepoLookup =
  | { status: "ok"; fullName: string; defaultBranch: string; isPrivate: boolean; language: string | null }
  | { status: "not_found" }
  | { status: "unavailable" };

const API = "https://api.github.com";
const HEADERS = { Accept: "application/vnd.github+json", "User-Agent": "Vajra" };
const enc = encodeURIComponent;

export async function lookupPublicRepo(owner: string, repo: string): Promise<RepoLookup> {
  try {
    const res = await fetch(`${API}/repos/${enc(owner)}/${enc(repo)}`, { headers: HEADERS, cache: "no-store" });
    // Private repositories also answer 404 to anonymous callers.
    if (res.status === 404) return { status: "not_found" };
    if (!res.ok) return { status: "unavailable" };
    const j = (await res.json()) as {
      full_name: string;
      default_branch: string;
      private: boolean;
      language: string | null;
    };
    return {
      status: "ok",
      fullName: j.full_name,
      defaultBranch: j.default_branch,
      isPrivate: j.private,
      language: j.language,
    };
  } catch {
    return { status: "unavailable" };
  }
}

/** true / false when GitHub answered, null when it couldn't be checked. */
export async function branchExists(owner: string, repo: string, branch: string): Promise<boolean | null> {
  try {
    const path = branch.split("/").map(enc).join("/");
    const res = await fetch(`${API}/repos/${enc(owner)}/${enc(repo)}/branches/${path}`, {
      headers: HEADERS,
      cache: "no-store",
    });
    if (res.status === 404) return false;
    return res.ok ? true : null;
  } catch {
    return null;
  }
}
