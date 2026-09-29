/**
 * Streams a repository tarball to a temp directory via
 * GET /repos/{owner}/{repo}/tarball/{ref} + tar-stream (IMPLEMENTATION_PLAN.md
 * §Phase 3 "Fetching the code"). Faster than a clone, needs no git binary,
 * and gives exactly the tree at the pushed commit.
 *
 * Callers MUST clean up the returned directory in a `finally` block — a
 * failed scan must not leak a checkout (§Phase 5 "Hardening").
 */
import { createGunzip } from "zlib";
import { extract } from "tar-stream";
import { mkdtemp, rm, mkdir, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join, dirname } from "path";
import { Readable } from "stream";
import { getInstallationOctokit } from "./auth";
import { safeJoin } from "@/server/security/paths";
import { lookupPublicRepo } from "./publicRepo";

export interface Checkout {
  dir: string;
  cleanup: () => Promise<void>;
  /** Set when the requested branch was missing and the default branch was scanned instead. */
  resolvedBranch?: string;
}

const MAX_TARBALL_BYTES = 200 * 1024 * 1024; // 200MB ceiling per scan

export async function checkoutTarball(
  installationId: number | null | undefined,
  owner: string,
  repo: string,
  ref: string,
): Promise<Checkout> {
  let buffer: Buffer;
  let resolvedBranch: string | undefined;

  if (installationId) {
    const octokit = await getInstallationOctokit(installationId);
    const res = await octokit.request("GET /repos/{owner}/{repo}/tarball/{ref}", {
      owner,
      repo,
      ref,
    });
    buffer = Buffer.from(res.data as ArrayBuffer);
  } else {
    // For manual/public repos without an app installation, download anonymously.
    // Each part is encoded so a crafted name can't change which GitHub URL is fetched.
    const archiveUrl = (b: string) =>
      `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/archive/refs/heads/${b
        .split("/")
        .map(encodeURIComponent)
        .join("/")}.tar.gz`;
    const wanted = ref.replace(/^refs\/heads\//, "");
    let res = await fetch(archiveUrl(wanted), { redirect: "follow" });

    // The branch may never have existed (added as "main" when the repository
    // uses "master"), or been renamed. Fall back to the current default branch.
    if (res.status === 404) {
      const lookup = await lookupPublicRepo(owner, repo);
      if (lookup.status === "not_found") {
        throw new Error(
          `GitHub couldn't find ${owner}/${repo}. It may have been deleted, renamed or made private; private repositories need the GitHub App.`,
        );
      }
      if (lookup.status === "ok" && lookup.defaultBranch !== wanted) {
        res = await fetch(archiveUrl(lookup.defaultBranch), { redirect: "follow" });
        if (res.ok) resolvedBranch = lookup.defaultBranch;
      }
    }
    if (!res.ok) {
      throw new Error(
        res.status === 404
          ? `${owner}/${repo} has no branch called "${wanted}". Check the branch name on the repository's page.`
          : `Downloading ${owner}/${repo} from GitHub failed: ${res.status} ${res.statusText}`,
      );
    }
    buffer = Buffer.from(await res.arrayBuffer());
  }

  if (buffer.byteLength > MAX_TARBALL_BYTES) {
    throw new Error(`Tarball for ${owner}/${repo}@${ref} exceeds ${MAX_TARBALL_BYTES} bytes`);
  }

  const dir = await mkdtemp(join(tmpdir(), "ecdat-scan-"));
  let bytesWritten = 0;
  let strippedRoot: string | null = null;

  try {
    await new Promise<void>((resolve, reject) => {
      const ex = extract();

      ex.on("entry", (header, stream, next) => {
        // GitHub tarballs wrap everything in a single "<owner>-<repo>-<sha>/" root — strip it.
        const parts = header.name.split("/");
        if (strippedRoot === null) strippedRoot = parts[0];
        const rel = parts.slice(1).join("/");

        if (!rel || header.type !== "file") {
          stream.resume();
          next();
          return;
        }

        const dest = safeJoin(dir, rel);
        if (!dest) {
          // An entry pointing outside the checkout (zip slip): skip it.
          stream.resume();
          next();
          return;
        }
        const chunks: Buffer[] = [];
        stream.on("data", (chunk: unknown) => {
          const buf = chunk as Buffer;
          bytesWritten += buf.length;
          if (bytesWritten > MAX_TARBALL_BYTES) {
            stream.destroy(new Error("Extracted content exceeds size ceiling"));
            return;
          }
          chunks.push(buf);
        });
        stream.on("end", async () => {
          try {
            await mkdir(dirname(dest), { recursive: true });
            await writeFile(dest, Buffer.concat(chunks));
            next();
          } catch (err) {
            next(err as Error);
          }
        });
        stream.on("error", next);
      });

      ex.on("finish", resolve);
      ex.on("error", reject);

      const gunzip = createGunzip();
      gunzip.on("error", reject);
      Readable.from(buffer).pipe(gunzip).pipe(ex);
    });
  } catch (err) {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
    throw err;
  }

  return {
    dir,
    resolvedBranch,
    cleanup: async () => {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    },
  };
}
