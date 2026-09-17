/**
 * Focused tests for the npm manifest/dependency crypto-library detector —
 * Phase 4, Step 3.
 *
 * Uses Node's built-in test runner (no new devDependency), mirroring
 * src/server/detectors/js-crypto.test.ts. Tests exercise the pure manifest
 * scanner directly — no database is touched.
 *
 * Run with:
 *   npx tsx --test src/server/detectors/manifest.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { computeManifestFingerprint, scanManifestsForCryptoLibraries } from "./manifest-scan";

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(data, null, 2));
}

async function withTempRepo(fn: (repoDir: string) => Promise<void>): Promise<void> {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "ecdat-manifest-test-"));
  try {
    await fn(tmp);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

// ─── Test 1 — known crypto library ─────────────────────────────────────────

test("detects a known crypto library declared in dependencies", async () => {
  await withTempRepo(async (repo) => {
    await writeJson(path.join(repo, "package.json"), {
      name: "demo",
      dependencies: { jose: "^5.0.0" },
    });

    const { detections, manifestsScanned } = await scanManifestsForCryptoLibraries(repo);

    assert.equal(manifestsScanned, 1);
    assert.equal(detections.length, 1);
    const [d] = detections;
    assert.equal(d.packageName, "jose");
    assert.equal(d.usage.name, "jose");
    assert.equal(d.usage.kind, "LIBRARY");
    assert.equal(d.manifestPath, "package.json");
    assert.equal(d.versionSource, "manifest-range");
    assert.equal(d.resolvedVersion, "^5.0.0");
  });
});

// ─── Test 2 — no crypto library ─────────────────────────────────────────────

test("an ordinary manifest with no known crypto libraries produces zero matches", async () => {
  await withTempRepo(async (repo) => {
    await writeJson(path.join(repo, "package.json"), {
      name: "demo",
      dependencies: { react: "^19.0.0", lodash: "^4.17.21" },
    });

    const { detections } = await scanManifestsForCryptoLibraries(repo);
    assert.deepEqual(detections, []);
  });
});

// ─── Test 3 — malformed package.json ───────────────────────────────────────

test("a malformed package.json is skipped without throwing, other manifests still scan", async () => {
  await withTempRepo(async (repo) => {
    await mkdir(path.join(repo, "broken"), { recursive: true });
    await writeFile(path.join(repo, "broken", "package.json"), "{ this is not valid JSON ");
    await writeJson(path.join(repo, "package.json"), {
      dependencies: { jose: "^5.0.0" },
    });

    const { detections, manifestsScanned, manifestsSkipped } = await scanManifestsForCryptoLibraries(repo);

    assert.equal(manifestsSkipped, 1);
    assert.equal(manifestsScanned, 1);
    assert.equal(detections.length, 1);
    assert.equal(detections[0].manifestPath, "package.json");
  });
});

// ─── Test 4 — lockfile version resolution ──────────────────────────────────

test("resolves the exact version from an adjacent package-lock.json", async () => {
  await withTempRepo(async (repo) => {
    await writeJson(path.join(repo, "package.json"), {
      dependencies: { jose: "^5.0.0" },
    });
    await writeJson(path.join(repo, "package-lock.json"), {
      lockfileVersion: 3,
      packages: {
        "": { name: "demo" },
        "node_modules/jose": { version: "5.9.6" },
      },
    });

    const { detections } = await scanManifestsForCryptoLibraries(repo);

    assert.equal(detections.length, 1);
    assert.equal(detections[0].resolvedVersion, "5.9.6");
    assert.equal(detections[0].versionSource, "lockfile");
  });
});

// ─── Test 5 — manifest range fallback ──────────────────────────────────────

test("falls back to the manifest version range when no lockfile entry resolves the package", async () => {
  await withTempRepo(async (repo) => {
    await writeJson(path.join(repo, "package.json"), {
      dependencies: { jose: "^5.0.0" },
    });
    // Lockfile exists but doesn't list jose (e.g. stale/partial lockfile).
    await writeJson(path.join(repo, "package-lock.json"), {
      lockfileVersion: 3,
      packages: { "": { name: "demo" } },
    });

    const { detections } = await scanManifestsForCryptoLibraries(repo);

    assert.equal(detections.length, 1);
    assert.equal(detections[0].resolvedVersion, "^5.0.0");
    assert.equal(detections[0].versionSource, "manifest-range");
  });
});

test("falls back to the manifest range when no lockfile exists at all", async () => {
  await withTempRepo(async (repo) => {
    await writeJson(path.join(repo, "package.json"), {
      dependencies: { jose: "^5.0.0" },
    });

    const { detections } = await scanManifestsForCryptoLibraries(repo);

    assert.equal(detections[0].resolvedVersion, "^5.0.0");
    assert.equal(detections[0].versionSource, "manifest-range");
  });
});

// ─── Test 6 — fingerprint determinism ──────────────────────────────────────

test("fingerprints are deterministic for identical inputs", () => {
  const a = computeManifestFingerprint("package.json", "jose");
  const b = computeManifestFingerprint("package.json", "jose");
  assert.equal(a, b);
});

test("fingerprint differs by manifest path or package name", () => {
  const base = computeManifestFingerprint("package.json", "jose");
  assert.notEqual(base, computeManifestFingerprint("packages/api/package.json", "jose"));
  assert.notEqual(base, computeManifestFingerprint("package.json", "node-forge"));
});

test("fingerprint is stable across Windows- and POSIX-style path separators", () => {
  const posix = computeManifestFingerprint("packages/api/package.json", "jose");
  const windows = computeManifestFingerprint("packages\\api\\package.json", "jose");
  assert.equal(posix, windows);
});

// ─── Test 7 — version does NOT affect fingerprint ──────────────────────────

test("fingerprint does not change when the resolved version changes", async () => {
  await withTempRepo(async (repo) => {
    await writeJson(path.join(repo, "package.json"), { dependencies: { jose: "^5.0.0" } });
    await writeJson(path.join(repo, "package-lock.json"), {
      packages: { "node_modules/jose": { version: "5.9.6" } },
    });
    const first = await scanManifestsForCryptoLibraries(repo);

    await writeJson(path.join(repo, "package-lock.json"), {
      packages: { "node_modules/jose": { version: "6.0.1" } },
    });
    const second = await scanManifestsForCryptoLibraries(repo);

    assert.equal(first.detections[0].resolvedVersion, "5.9.6");
    assert.equal(second.detections[0].resolvedVersion, "6.0.1");
    assert.equal(first.detections[0].fingerprint, second.detections[0].fingerprint);
  });
});

// ─── Test 8 — nested manifest ───────────────────────────────────────────────

test("discovers and reports a nested manifest with a repo-relative, non-absolute path", async () => {
  await withTempRepo(async (repo) => {
    await writeJson(path.join(repo, "packages", "api", "package.json"), {
      dependencies: { jose: "^5.0.0" },
    });

    const { detections } = await scanManifestsForCryptoLibraries(repo);

    assert.equal(detections.length, 1);
    assert.equal(detections[0].manifestPath, "packages/api/package.json");
    assert.ok(!path.isAbsolute(detections[0].manifestPath));
    assert.ok(!detections[0].manifestPath.includes(os.tmpdir().replace(/\\/g, "/")));
  });
});

// ─── Test 9 — devDependencies ───────────────────────────────────────────────

test("detects a known crypto library declared only in devDependencies", async () => {
  await withTempRepo(async (repo) => {
    await writeJson(path.join(repo, "package.json"), {
      devDependencies: { bcrypt: "^5.1.0" },
    });

    const { detections } = await scanManifestsForCryptoLibraries(repo);

    assert.equal(detections.length, 1);
    assert.equal(detections[0].packageName, "bcrypt");
  });
});

// ─── Test 10 — peerDependencies ignored ────────────────────────────────────

test("ignores a known crypto library declared only in peerDependencies", async () => {
  await withTempRepo(async (repo) => {
    await writeJson(path.join(repo, "package.json"), {
      peerDependencies: { jose: "^5.0.0" },
    });

    const { detections } = await scanManifestsForCryptoLibraries(repo);
    assert.deepEqual(detections, []);
  });
});

// ─── Test 11 — excluded node_modules ───────────────────────────────────────

test("does not scan a package.json inside node_modules", async () => {
  await withTempRepo(async (repo) => {
    await writeJson(path.join(repo, "package.json"), { dependencies: {} });
    await writeJson(path.join(repo, "node_modules", "jose", "package.json"), {
      name: "jose",
      dependencies: { "some-other-crypto-lib": "1.0.0" },
    });

    const { detections, manifestsScanned } = await scanManifestsForCryptoLibraries(repo);

    assert.equal(manifestsScanned, 1); // only the root manifest
    assert.deepEqual(detections, []);
  });
});

// ─── Test 12 — multiple known libraries ────────────────────────────────────

test("returns each matching library exactly once per manifest", async () => {
  await withTempRepo(async (repo) => {
    await writeJson(path.join(repo, "package.json"), {
      dependencies: { jose: "^5.0.0", "node-forge": "^1.3.1" },
      devDependencies: { bcrypt: "^5.1.0" },
    });

    const { detections } = await scanManifestsForCryptoLibraries(repo);

    const names = detections.map((d) => d.packageName).sort();
    assert.deepEqual(names, ["bcrypt", "jose", "node-forge"]);
    assert.equal(new Set(detections.map((d) => d.fingerprint)).size, 3);
  });
});

// ─── Additional: onLog never receives raw file contents ───────────────────

test("onLog messages never include raw manifest JSON contents", async () => {
  await withTempRepo(async (repo) => {
    await writeJson(path.join(repo, "package.json"), {
      dependencies: { jose: "^5.0.0" },
      secretMarkerThatShouldNeverBeLogged: "TOP_SECRET_VALUE",
    });

    const messages: string[] = [];
    await scanManifestsForCryptoLibraries(repo, (_level, message) => {
      messages.push(message);
    });

    for (const message of messages) {
      assert.ok(!message.includes("TOP_SECRET_VALUE"));
    }
  });
});
