/**
 * Focused tests for the JS/TS crypto call-site detector — Phase 4, Step 2.
 *
 * Uses Node's built-in test runner (no new devDependency), matching the
 * pattern established for checkout.ts in Phase 4, Step 1. These exercise the
 * pure matching/fingerprinting logic and real file discovery directly —
 * no database is touched (persistence is a thin Prisma upsert already
 * covered by manual verification and code review).
 *
 * Run with:
 *   npx tsx --test src/server/detectors/js-crypto.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { computeFingerprint, discoverSourceFiles, scanSourceForCryptoUsage } from "./js-crypto-scan";

// ─── Node crypto call sites ─────────────────────────────────────────────────

test("detects Node createHash and normalizes the algorithm", () => {
  const content = ['import { createHash } from "crypto";', "", 'const hash = createHash("sha256");', ""].join(
    "\n"
  );
  const detections = scanSourceForCryptoUsage(content, "src/auth/encryption.ts");

  assert.equal(detections.length, 1);
  const [d] = detections;
  assert.equal(d.ruleId, "js.node.createHash");
  assert.equal(d.relativeFilePath, "src/auth/encryption.ts");
  assert.equal(d.lineNumber, 3);
  assert.equal(d.usage.algorithm, "SHA-256");
  assert.equal(d.usage.kind, "ALGORITHM");
  assert.equal(d.usage.quantumSafe, true);
});

test("detects Node createHmac and normalizes the underlying hash", () => {
  const content = 'const mac = crypto.createHmac("sha256", secret);';
  const [d] = scanSourceForCryptoUsage(content, "src/mac.js");

  assert.equal(d.ruleId, "js.node.createHmac");
  assert.equal(d.usage.name, "HMAC-SHA-256");
  assert.equal(d.usage.primitive, "mac");
  assert.equal(d.usage.quantumSafe, true);
});

test("detects Node createCipheriv and normalizes cipher spec (algorithm, mode, key length)", () => {
  const content = 'const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);';
  const [d] = scanSourceForCryptoUsage(content, "src/cipher.js");

  assert.equal(d.ruleId, "js.node.createCipheriv");
  assert.equal(d.usage.algorithm, "AES-256-GCM");
  assert.equal(d.usage.mode, "gcm");
  assert.equal(d.usage.keyLengthBits, 256);
  assert.equal(d.usage.quantumSafe, true);
});

test("detects a weak cipher (3DES) as not quantum-safe", () => {
  const content = 'const cipher = crypto.createDecipheriv("des-ede3-cbc", key, iv);';
  const [d] = scanSourceForCryptoUsage(content, "src/legacy.js");

  assert.equal(d.ruleId, "js.node.createDecipheriv");
  assert.equal(d.usage.name, "3DES");
  assert.equal(d.usage.quantumSafe, false);
});

// ─── WebCrypto ──────────────────────────────────────────────────────────────

test("detects crypto.subtle.digest and normalizes the WebCrypto algorithm name", () => {
  const content = 'const digest = await crypto.subtle.digest("SHA-256", data);';
  const [d] = scanSourceForCryptoUsage(content, "src/web/hash.ts");

  assert.equal(d.ruleId, "js.webcrypto.subtle.digest");
  assert.equal(d.usage.algorithm, "SHA-256");
  assert.equal(d.usage.quantumSafe, true);
});

test("detects crypto.subtle.encrypt with an object-form algorithm argument", () => {
  const content = 'const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);';
  const [d] = scanSourceForCryptoUsage(content, "src/web/encrypt.ts");

  assert.equal(d.ruleId, "js.webcrypto.subtle.encrypt");
  assert.equal(d.usage.algorithm, "AES-GCM");
});

// ─── TypeScript source ──────────────────────────────────────────────────────

test("detects crypto call sites in TypeScript source", () => {
  const content = 'const hash = crypto.createHash("sha512");';
  const [d] = scanSourceForCryptoUsage(content, "src/auth/encryption.ts");

  assert.equal(d.usage.algorithm, "SHA-512");
  assert.equal(d.usage.quantumSafe, true);
});

// ─── CommonJS require/destructuring ─────────────────────────────────────────

test("detects CommonJS require + destructuring usage", () => {
  const content = ['const { createHash } = require("crypto");', "", 'const h = createHash("sha256");'].join("\n");
  const detections = scanSourceForCryptoUsage(content, "src/legacy.cjs");

  assert.equal(detections.length, 1);
  assert.equal(detections[0].lineNumber, 3);
  assert.equal(detections[0].usage.algorithm, "SHA-256");
});

// ─── Negative cases ─────────────────────────────────────────────────────────

test("a normal non-crypto file produces no detections", () => {
  const content = ["export function add(a: number, b: number): number {", "  return a + b;", "}"].join("\n");
  const detections = scanSourceForCryptoUsage(content, "src/math.ts");

  assert.deepEqual(detections, []);
});

test("an unsupported file extension produces no detections", () => {
  const content = 'const hash = createHash("sha256");';
  assert.deepEqual(scanSourceForCryptoUsage(content, "notes.md"), []);
});

test("a dynamic, non-literal algorithm argument is not statically resolved", () => {
  const content = "const hash = createHash(algoFromConfig);";
  assert.deepEqual(scanSourceForCryptoUsage(content, "src/dynamic.js"), []);
});

// ─── File discovery ─────────────────────────────────────────────────────────

test("discoverSourceFiles ignores generated/dependency directories", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "ecdat-detector-test-"));
  try {
    await mkdir(path.join(tmp, "src"), { recursive: true });
    await mkdir(path.join(tmp, "node_modules", "pkg"), { recursive: true });
    await mkdir(path.join(tmp, "dist"), { recursive: true });
    await mkdir(path.join(tmp, ".git", "hooks"), { recursive: true });

    await writeFile(path.join(tmp, "src", "index.ts"), 'createHash("sha256");');
    await writeFile(path.join(tmp, "node_modules", "pkg", "index.js"), 'createHash("md5");');
    await writeFile(path.join(tmp, "dist", "bundle.js"), 'createHash("md5");');
    await writeFile(path.join(tmp, ".git", "hooks", "pre-commit"), "#!/bin/sh");

    const files = await discoverSourceFiles(tmp);

    assert.deepEqual(files, ["src/index.ts"]);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

// ─── Fingerprint determinism ────────────────────────────────────────────────

test("fingerprints are deterministic for identical inputs", () => {
  const content = 'const hash = createHash("sha256");';
  const first = scanSourceForCryptoUsage(content, "src/a.ts");
  const second = scanSourceForCryptoUsage(content, "src/a.ts");

  assert.equal(first[0].fingerprint, second[0].fingerprint);
});

test("running the detector twice on the same fixture yields identical fingerprints", () => {
  const content = [
    'import { createHash, createHmac } from "crypto";',
    "",
    'const a = createHash("sha256");',
    'const b = createHmac("sha256", secret);',
    'const c = crypto.createCipheriv("aes-256-gcm", key, iv);',
  ].join("\n");

  const run1 = scanSourceForCryptoUsage(content, "src/multi.ts").map((d) => d.fingerprint);
  const run2 = scanSourceForCryptoUsage(content, "src/multi.ts").map((d) => d.fingerprint);

  assert.deepEqual(run1, run2);
  assert.equal(new Set(run1).size, run1.length, "fingerprints within one scan should be unique per call site");
});

test("fingerprint differs when line number, file path, or algorithm differs", () => {
  const usage = { kind: "ALGORITHM" as const, name: "SHA-256", algorithm: "SHA-256" };
  const base = computeFingerprint("js.node.createHash", "src/a.ts", 3, usage);

  assert.notEqual(base, computeFingerprint("js.node.createHash", "src/a.ts", 4, usage));
  assert.notEqual(base, computeFingerprint("js.node.createHash", "src/b.ts", 3, usage));
  assert.notEqual(
    base,
    computeFingerprint("js.node.createHash", "src/a.ts", 3, { ...usage, algorithm: "SHA-512", name: "SHA-512" })
  );
  assert.equal(base, computeFingerprint("js.node.createHash", "src/a.ts", 3, usage));
});

test("fingerprint is stable across Windows- and POSIX-style path separators", () => {
  const usage = { kind: "ALGORITHM" as const, name: "SHA-256", algorithm: "SHA-256" };
  const posix = computeFingerprint("js.node.createHash", "src/a.ts", 3, usage);
  const windows = computeFingerprint("js.node.createHash", "src\\a.ts", 3, usage);

  assert.equal(posix, windows);
});

// ─── Multiple occurrences on one line ──────────────────────────────────────

test("multiple matching calls on a single line are each detected", () => {
  const content = 'createHash("sha256"); createHash("sha256");';
  const detections = scanSourceForCryptoUsage(content, "src/repeat.js");

  assert.equal(detections.length, 2);
  assert.equal(detections[0].fingerprint, detections[1].fingerprint);
});
