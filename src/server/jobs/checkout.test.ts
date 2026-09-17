/**
 * Focused tests for checkout.ts — Phase 4, Step 1.
 *
 * Uses Node's built-in test runner (no new devDependency). Run with:
 *   npx tsx --test src/server/jobs/checkout.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { gzipSync } from "node:zlib";
import { pack as tarPack } from "tar-stream";

import { extractTarball, fetchRepoTarball, sanitizeEntryPath, type FetchRepoTarballDeps } from "./checkout";
import type { ScanJobPayload } from "./queue";

function makePayload(overrides: Partial<ScanJobPayload> = {}): ScanJobPayload {
  return {
    scanId: `test-scan-${Math.random().toString(36).slice(2)}`,
    repositoryId: "repo-1",
    installationId: 123,
    owner: "acme",
    repo: "widgets",
    ref: "main",
    commitSha: "deadbeef",
    ...overrides,
  };
}

/** Builds a gzip-compressed tarball with a single "owner-repo-sha/" wrapper. */
async function buildTarball(entries: Array<{ name: string; content?: string; type?: "file" | "directory" | "symlink"; linkname?: string }>): Promise<Buffer> {
  const pack = tarPack();
  const chunks: Buffer[] = [];
  // Drain the readable side concurrently with writing entries — tar-stream's
  // write callback for a large entry only fires once its data is consumed,
  // so writing sequentially before reading anything deadlocks on big bodies.
  const readDone = (async () => {
    for await (const chunk of pack) {
      chunks.push(chunk as Buffer);
    }
  })();

  for (const entry of entries) {
    const body = entry.content ?? "";
    await new Promise<void>((resolve, reject) => {
      pack.entry(
        {
          name: entry.name,
          type: entry.type ?? "file",
          size: entry.type === "directory" ? 0 : Buffer.byteLength(body),
          linkname: entry.linkname,
        },
        body,
        (err) => (err ? reject(err) : resolve())
      );
    });
  }
  pack.finalize();
  await readDone;

  return gzipSync(Buffer.concat(chunks));
}

// ─── sanitizeEntryPath ──────────────────────────────────────────────────────

test("sanitizeEntryPath strips the GitHub wrapper directory", () => {
  assert.equal(sanitizeEntryPath("acme-widgets-deadbeef/src/index.ts"), path.join("src", "index.ts"));
});

test("sanitizeEntryPath rejects a path-traversal attempt", () => {
  assert.equal(sanitizeEntryPath("acme-widgets-deadbeef/../../evil.txt"), null);
  assert.equal(sanitizeEntryPath("../../../tmp/evil"), null);
});

test("sanitizeEntryPath rejects an absolute path", () => {
  assert.equal(sanitizeEntryPath("/etc/passwd"), null);
});

test("sanitizeEntryPath rejects the bare wrapper directory entry", () => {
  assert.equal(sanitizeEntryPath("acme-widgets-deadbeef/"), null);
});

// ─── extractTarball ─────────────────────────────────────────────────────────

test("extractTarball extracts normal files and counts them", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "ecdat-test-"));
  try {
    const tarball = await buildTarball([
      { name: "acme-widgets-deadbeef/src/index.ts", content: "export const x = 1;" },
      { name: "acme-widgets-deadbeef/README.md", content: "hello" },
    ]);
    const result = await extractTarball(Readable.from(tarball), tmp, new AbortController().signal);

    assert.equal(result.fileCount, 2);
    assert.equal(result.skippedFileCount, 0);
    assert.equal(await readFile(path.join(tmp, "src", "index.ts"), "utf8"), "export const x = 1;");
    assert.equal(await readFile(path.join(tmp, "README.md"), "utf8"), "hello");
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test("extractTarball rejects a path-traversal entry without writing outside the root", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "ecdat-test-"));
  try {
    const tarball = await buildTarball([
      { name: "acme-widgets-deadbeef/safe.txt", content: "ok" },
      { name: "acme-widgets-deadbeef/../../evil.txt", content: "pwned" },
    ]);
    const result = await extractTarball(Readable.from(tarball), tmp, new AbortController().signal);

    assert.equal(result.fileCount, 1);
    assert.equal(result.skippedFileCount, 1);

    const escaped = path.join(tmp, "..", "evil.txt");
    await assert.rejects(() => stat(escaped));
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test("extractTarball skips symlink entries safely", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "ecdat-test-"));
  try {
    const tarball = await buildTarball([
      { name: "acme-widgets-deadbeef/link", type: "symlink", linkname: "/etc/passwd" },
      { name: "acme-widgets-deadbeef/real.txt", content: "hi" },
    ]);
    const result = await extractTarball(Readable.from(tarball), tmp, new AbortController().signal);

    assert.equal(result.fileCount, 1);
    assert.equal(result.skippedFileCount, 1);
    const entries = await readdir(tmp);
    assert.ok(!entries.includes("link"));
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test("extractTarball skips a file exceeding the size limit without writing a partial file", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "ecdat-test-"));
  try {
    // tar-stream derives the header size from the actual body length, so the
    // body itself must exceed the 5 MB cap for this to exercise the limit.
    const bigContent = "x".repeat(6 * 1024 * 1024);
    const tarball = await buildTarball([{ name: "acme-widgets-deadbeef/huge.bin", content: bigContent }]);
    const result = await extractTarball(Readable.from(tarball), tmp, new AbortController().signal);

    assert.equal(result.fileCount, 0);
    assert.equal(result.skippedFileCount, 1);
    const entries = await readdir(tmp);
    assert.ok(!entries.includes("huge.bin"));
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test("extractTarball aborts and rejects when the signal fires", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "ecdat-test-"));
  try {
    // A stream that never ends simulates a stalled download/extraction.
    const stalled = new Readable({ read() {} });
    const controller = new AbortController();
    setTimeout(() => controller.abort(new Error("test timeout")), 20);

    await assert.rejects(() => extractTarball(stalled, tmp, controller.signal));
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

// ─── fetchRepoTarball ───────────────────────────────────────────────────────

test("fetchRepoTarball throws a diagnosable error on GitHub HTTP failure and cleans up", async () => {
  const payload = makePayload();
  const deps: FetchRepoTarballDeps = {
    getInstallationToken: async () => "fake-token",
    fetchImpl: (async () =>
      new Response(null, { status: 404, statusText: "Not Found" })) as unknown as typeof fetch,
  };

  await assert.rejects(() => fetchRepoTarball(payload, undefined, deps), /HTTP 404/);

  const dir = path.join(os.tmpdir(), `ecdat-scan-${payload.scanId}`);
  await assert.rejects(() => stat(dir), "temp directory should be cleaned up after failure");
});

test("fetchRepoTarball never forwards the installation token to an untrusted redirect host", async () => {
  const payload = makePayload();
  const seenAuthHeaders: Array<string | null> = [];
  const deps: FetchRepoTarballDeps = {
    getInstallationToken: async () => "super-secret-token",
    fetchImpl: (async (input: unknown, init?: RequestInit) => {
      const url = String(input);
      const auth = (init?.headers as Record<string, string> | undefined)?.Authorization ?? null;
      seenAuthHeaders.push(auth);
      if (url.includes("api.github.com")) {
        return new Response(null, {
          status: 302,
          headers: { location: "https://evil.example.com/steal" },
        });
      }
      throw new Error("should not reach this host");
    }) as unknown as typeof fetch,
  };

  await assert.rejects(() => fetchRepoTarball(payload, undefined, deps), /untrusted host/);
  assert.equal(seenAuthHeaders[0], "Bearer super-secret-token");

  const dir = path.join(os.tmpdir(), `ecdat-scan-${payload.scanId}`);
  await assert.rejects(() => stat(dir));
});

test("fetchRepoTarball performs a full successful extraction end to end", async () => {
  const payload = makePayload();
  const tarball = await buildTarball([
    { name: `${payload.owner}-${payload.repo}-${payload.commitSha}/src/app.ts`, content: "console.log(1);" },
  ]);

  const deps: FetchRepoTarballDeps = {
    getInstallationToken: async () => "fake-token",
    fetchImpl: (async (input: unknown) => {
      const url = String(input);
      assert.ok(url.startsWith("https://api.github.com/repos/acme/widgets/tarball/main"));
      return new Response(new Uint8Array(tarball), { status: 200 });
    }) as unknown as typeof fetch,
  };

  try {
    const result = await fetchRepoTarball(payload, undefined, deps);
    assert.equal(result.fileCount, 1);
    assert.equal(result.skippedFileCount, 0);
    assert.equal(await readFile(path.join(result.dir, "src", "app.ts"), "utf8"), "console.log(1);");
  } finally {
    await rm(path.join(os.tmpdir(), `ecdat-scan-${payload.scanId}`), { recursive: true, force: true });
  }
});
