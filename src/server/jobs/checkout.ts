/**
 * Real GitHub repository checkout — Phase 4, Step 1.
 *
 * Downloads a repository tarball from the GitHub REST API and streams it
 * (gunzip -> tar extract) into a unique temporary directory. No detection
 * logic lives here — this only establishes the real repository filesystem
 * that future detectors (Phase 4, Step 2+) will scan.
 */
import { createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { Readable } from "node:stream";
import { pipeline as streamPipeline } from "node:stream/promises";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";
import { createGunzip } from "node:zlib";

import { extract as tarExtract, type Header } from "tar-stream";

import { getInstallationToken } from "@/server/github/auth";
import type { ScanJobPayload } from "./queue";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB per-file extraction cap
const TOTAL_TIMEOUT_MS = 60_000; // covers download + decompression + extraction
const GITHUB_API_HOST = "api.github.com";
// The installation token is only ever sent to the GitHub API itself. A
// redirect to codeload (or back to github.com) is followed without the
// token attached.
const ALLOWED_REDIRECT_HOSTS = new Set(["codeload.github.com", "api.github.com", "github.com"]);
const MAX_REDIRECTS = 5;

export type CheckoutLogLevel = "INFO" | "WARN" | "ERROR";
export type CheckoutLogger = (level: CheckoutLogLevel, message: string) => void | Promise<void>;

export interface CheckoutResult {
  dir: string;
  fileCount: number;
  skippedFileCount: number;
}

export interface FetchRepoTarballDeps {
  getInstallationToken: (installationId: number) => Promise<string>;
  fetchImpl: typeof fetch;
}

const defaultDeps: FetchRepoTarballDeps = { getInstallationToken, fetchImpl: fetch };

/**
 * Downloads and securely extracts the tarball for `payload.owner/payload.repo`
 * at `payload.ref` into a fresh temp directory. Cleans up that directory
 * itself if anything fails before a result can be returned.
 *
 * `deps` defaults to the real GitHub token minter and global fetch; tests
 * inject fakes for both so this can be exercised without real network calls.
 */
export async function fetchRepoTarball(
  payload: ScanJobPayload,
  onLog: CheckoutLogger = () => {},
  deps: FetchRepoTarballDeps = defaultDeps
): Promise<CheckoutResult> {
  const { installationId, owner, repo, ref, scanId } = payload;
  const dir = path.join(os.tmpdir(), `ecdat-scan-${scanId}`);

  // Clean slate in case a previous crashed attempt left this directory behind.
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error(`Repository checkout exceeded ${TOTAL_TIMEOUT_MS}ms timeout`)),
    TOTAL_TIMEOUT_MS
  );

  try {
    // Minted fresh for this checkout only — never cached, never persisted.
    const token = await deps.getInstallationToken(installationId);
    const response = await fetchTarballFollowingRedirects(
      owner,
      repo,
      ref,
      token,
      controller.signal,
      deps.fetchImpl
    );

    if (!response.body) {
      throw new Error(`GitHub tarball download failed: empty response body for ${owner}/${repo}@${ref}`);
    }

    const source = Readable.fromWeb(response.body as unknown as NodeWebReadableStream<Uint8Array>);
    const { fileCount, skippedFileCount } = await extractTarball(source, dir, controller.signal, onLog);
    return { dir, fileCount, skippedFileCount };
  } catch (err) {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTarballFollowingRedirects(
  owner: string,
  repo: string,
  ref: string,
  token: string,
  signal: AbortSignal,
  fetchImpl: typeof fetch
): Promise<Response> {
  let url = `https://${GITHUB_API_HOST}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/tarball/${encodeURIComponent(ref)}`;
  let attachAuth = true;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "ecdat-atlas-scanner",
    };
    if (attachAuth) {
      headers.Authorization = `Bearer ${token}`;
    }

    let response: Response;
    try {
      response = await fetchImpl(url, { headers, redirect: "manual", signal });
    } catch (err) {
      if (signal.aborted) {
        throw new Error(`GitHub tarball download failed: timed out downloading ${owner}/${repo}@${ref}`);
      }
      throw err;
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new Error(`GitHub tarball download failed: HTTP ${response.status} redirect with no Location header`);
      }
      const next = new URL(location, url);
      if (!ALLOWED_REDIRECT_HOSTS.has(next.hostname)) {
        throw new Error(`GitHub tarball download failed: refused redirect to untrusted host "${next.hostname}"`);
      }
      // Only re-attach the installation token if we're still talking to the GitHub API.
      attachAuth = next.hostname === GITHUB_API_HOST;
      url = next.toString();
      continue;
    }

    if (!response.ok) {
      throw new Error(`GitHub tarball download failed: HTTP ${response.status} for ${owner}/${repo}@${ref}`);
    }

    return response;
  }

  throw new Error(`GitHub tarball download failed: exceeded ${MAX_REDIRECTS} redirects for ${owner}/${repo}@${ref}`);
}

/**
 * Streams a gzipped tarball from `source` into `destRoot`, exported so tests
 * can feed it an in-memory tarball directly without going through fetch.
 */
export async function extractTarball(
  source: NodeJS.ReadableStream,
  destRoot: string,
  signal: AbortSignal,
  onLog: CheckoutLogger = () => {}
): Promise<{ fileCount: number; skippedFileCount: number }> {
  const gunzip = createGunzip();
  const extract = tarExtract();

  let fileCount = 0;
  let skippedFileCount = 0;

  extract.on("entry", (header, stream, next) => {
    handleEntry(header, stream, destRoot, onLog)
      .then((outcome) => {
        if (outcome === "extracted") fileCount++;
        if (outcome === "skipped") skippedFileCount++;
        next();
      })
      .catch((err: unknown) => {
        next(err instanceof Error ? err : new Error(String(err)));
      });
  });

  try {
    await streamPipeline(source, gunzip, extract, { signal });
  } catch (err) {
    if (signal.aborted) {
      throw new Error("Repository checkout timed out during download/extraction");
    }
    throw err;
  }

  return { fileCount, skippedFileCount };
}

type EntryOutcome = "extracted" | "skipped" | "directory-created";

async function handleEntry(
  header: Header,
  stream: unknown,
  destRoot: string,
  onLog: CheckoutLogger
): Promise<EntryOutcome> {
  const relative = sanitizeEntryPath(header.name);

  if (relative === null) {
    await drainEntry(stream);
    await onLog("WARN", `[checkout] rejected unsafe archive path: ${header.name}`);
    return "skipped";
  }

  const resolvedRoot = path.resolve(destRoot);
  const resolvedPath = path.resolve(resolvedRoot, relative);

  if (resolvedPath !== resolvedRoot && !resolvedPath.startsWith(resolvedRoot + path.sep)) {
    await drainEntry(stream);
    await onLog("WARN", `[checkout] rejected archive path escaping extraction root: ${header.name}`);
    return "skipped";
  }

  if (header.type === "symlink" || header.type === "link") {
    await drainEntry(stream);
    await onLog("WARN", `[checkout] skipped symlink entry: ${header.name}`);
    return "skipped";
  }

  if (header.type === "directory") {
    await drainEntry(stream);
    await mkdir(resolvedPath, { recursive: true });
    return "directory-created";
  }

  if (header.type !== "file") {
    await drainEntry(stream);
    await onLog("WARN", `[checkout] skipped unsupported entry type "${header.type}": ${header.name}`);
    return "skipped";
  }

  if (header.size > MAX_FILE_BYTES) {
    await drainEntry(stream);
    await onLog(
      "WARN",
      `[checkout] skipped ${header.name} (${header.size} bytes) — exceeds ${MAX_FILE_BYTES}-byte limit`
    );
    return "skipped";
  }

  await mkdir(path.dirname(resolvedPath), { recursive: true });
  await writeEntryToFile(stream, resolvedPath);
  return "extracted";
}

/**
 * Strips the wrapper directory GitHub tarballs always add (`owner-repo-sha/`)
 * and rejects absolute paths or any `..` segment. Returns null for anything
 * unsafe or for the wrapper directory entry itself.
 */
export function sanitizeEntryPath(entryName: string): string | null {
  if (!entryName) return null;

  const normalized = entryName.replace(/\\/g, "/");
  if (normalized.startsWith("/")) return null; // absolute path in archive

  const segments = normalized.split("/").filter((segment) => segment.length > 0 && segment !== ".");
  if (segments.length === 0) return null;

  const withoutWrapper = segments.slice(1);
  if (withoutWrapper.length === 0) return null; // the wrapper directory entry itself
  if (withoutWrapper.includes("..")) return null;

  return path.join(...withoutWrapper);
}

// tar-stream's entry stream type ("Source") is not exported from its type
// declarations, so these two helpers accept `unknown` and narrow internally —
// the runtime object is a standard Node-compatible readable stream.

function drainEntry(stream: unknown): Promise<void> {
  const readable = stream as NodeJS.ReadableStream;
  return new Promise((resolve, reject) => {
    readable.once("end", () => resolve());
    readable.once("error", reject);
    readable.resume();
  });
}

async function writeEntryToFile(stream: unknown, destPath: string): Promise<void> {
  const readable = stream as NodeJS.ReadableStream;
  const out = createWriteStream(destPath);
  await streamPipeline(readable, out);
}
