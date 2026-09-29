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

export interface Checkout {
  dir: string;
  cleanup: () => Promise<void>;
}

const MAX_TARBALL_BYTES = 200 * 1024 * 1024; // 200MB ceiling per scan

export async function checkoutTarball(
  installationId: number | null | undefined,
  owner: string,
  repo: string,
  ref: string
): Promise<Checkout> {
  let buffer: Buffer;
  
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
    const branch = ref.replace(/^refs\/heads\//, "").split("/").map(encodeURIComponent).join("/");
    const url = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/archive/refs/heads/${branch}.tar.gz`;
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) {
      throw new Error(`Failed to fetch tarball from ${url}: ${res.status} ${res.statusText}`);
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
    cleanup: async () => {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    },
  };
}
