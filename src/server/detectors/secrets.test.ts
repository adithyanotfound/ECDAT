/**
 * Focused tests for the entropy-gated secret detector — Phase 5, Step 8.
 *
 * Uses Node's built-in test runner, mirroring js-crypto.test.ts /
 * certkey.test.ts. Tests exercise the pure secrets-scan.ts scanner directly
 * (plus real file discovery in a temp dir for the exclusion tests) — no
 * database is touched.
 *
 * SAFETY NOTE FOR THIS FILE ITSELF: every fake secret below exists only to
 * verify detection/exclusion logic. Assertions never compare a value
 * *equal to* a raw fake secret (which would print it in a failure diff) —
 * only boolean checks (assert.ok/assert.equal against `false`) are used
 * around any raw-value-leak check, so even a *failing* assertion here never
 * echoes a candidate value in test output.
 *
 * Run with:
 *   npx tsx --test src/server/detectors/secrets.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  scanSourceForSecrets,
  scanFilesForSecrets,
  discoverSecretScanFiles,
  shannonEntropy,
  isCryptoAdjacentIdentifier,
  safeSecretRepresentation,
  computeSecretFingerprint,
  looksGenerated,
  SECRET_MIN_LENGTH,
  SECRET_MIN_ENTROPY,
  RULE_HARDCODED_SECRET,
} from "./secrets-scan";

// A high-entropy, 32-character hex-like fake value — never a real secret,
// used only to exercise the detection path.
const HIGH_ENTROPY_VALUE = "9f2a7c31e08b4d6f5a1c9e3b7d2f8a04";

function resolve(rawValue: string, lineNumber: number) {
  const { safeName, fullHashHex } = safeSecretRepresentation(rawValue);
  return { fingerprint: computeSecretFingerprint(RULE_HARDCODED_SECRET, "src/x.ts", lineNumber, fullHashHex), safeName };
}

// ─── Entropy formula sanity ─────────────────────────────────────────────────

test("shannonEntropy: a constant string has zero entropy", () => {
  assert.equal(shannonEntropy("aaaaaaaaaaaaaaaaaaaa"), 0);
});

test("shannonEntropy: a high-diversity string exceeds the 3.5 threshold", () => {
  assert.ok(shannonEntropy(HIGH_ENTROPY_VALUE) >= SECRET_MIN_ENTROPY);
});

test("isCryptoAdjacentIdentifier: requires a crypto/TLS term combined with a secret-shaped term", () => {
  assert.equal(isCryptoAdjacentIdentifier("jwtSigningSecret"), true);
  assert.equal(isCryptoAdjacentIdentifier("encryptionKey"), true);
  assert.equal(isCryptoAdjacentIdentifier("hmacSecret"), true);
  assert.equal(isCryptoAdjacentIdentifier("privateKey"), true);
  assert.equal(isCryptoAdjacentIdentifier("tlsCredential"), true);
  // Bare secret-shaped words alone must NOT qualify — this is the precision requirement.
  assert.equal(isCryptoAdjacentIdentifier("password"), false);
  assert.equal(isCryptoAdjacentIdentifier("token"), false);
  assert.equal(isCryptoAdjacentIdentifier("secret"), false);
  assert.equal(isCryptoAdjacentIdentifier("credential"), false);
});

// ─── 1. genuine crypto-adjacent high-entropy hardcoded secret ─────────────

test("a genuine crypto-adjacent high-entropy hardcoded secret is detected", () => {
  const content = `const jwtSigningSecret = "${HIGH_ENTROPY_VALUE}";`;
  const results = scanSourceForSecrets(content, "src/auth.ts", resolve);

  assert.equal(results.length, 1);
  assert.equal(results[0].identifier, "jwtSigningSecret");
  assert.ok(results[0].entropy >= SECRET_MIN_ENTROPY);
  assert.equal(results[0].length, HIGH_ENTROPY_VALUE.length);
});

// ─── 2. below 20 characters -> not detected ────────────────────────────────

test("the same candidate truncated below 20 characters is not detected", () => {
  const shortValue = HIGH_ENTROPY_VALUE.slice(0, 15);
  assert.ok(shortValue.length < SECRET_MIN_LENGTH);
  const content = `const jwtSigningSecret = "${shortValue}";`;
  assert.equal(scanSourceForSecrets(content, "src/auth.ts", resolve).length, 0);
});

// ─── 3. below entropy 3.5 -> not detected ──────────────────────────────────

test("a long but low-entropy candidate is not detected", () => {
  const lowEntropyValue = "aaaaaaaaaaaaaaaaaaaaaaaa"; // 24 chars, entropy 0
  assert.ok(lowEntropyValue.length >= SECRET_MIN_LENGTH);
  assert.ok(shannonEntropy(lowEntropyValue) < SECRET_MIN_ENTROPY);
  const content = `const encryptionKey = "${lowEntropyValue}";`;
  assert.equal(scanSourceForSecrets(content, "src/auth.ts", resolve).length, 0);
});

// ─── 4. process.env.SECRET -> not detected ─────────────────────────────────

test("process.env references are never detected, even alongside a would-otherwise-match literal on the same line", () => {
  const bare = `const jwtSigningSecret = process.env.JWT_SECRET;`;
  assert.equal(scanSourceForSecrets(bare, "src/auth.ts", resolve).length, 0);

  const mixedLine = `const jwtSigningSecret = "${HIGH_ENTROPY_VALUE}"; void process.env.NODE_ENV;`;
  assert.equal(scanSourceForSecrets(mixedLine, "src/auth.ts", resolve).length, 0);
});

// ─── 5. environment variable reference (general) -> not detected ──────────

test("other environment-variable reference forms are excluded (os.environ, System.getenv, ENV[, .NET Environment.GetEnvironmentVariable)", () => {
  const cases = [
    `encryption_key = "${HIGH_ENTROPY_VALUE}"  # os.environ["X"]`,
    `var signingKey = "${HIGH_ENTROPY_VALUE}"; System.getenv("X");`,
    `hmac_secret = "${HIGH_ENTROPY_VALUE}" # ENV['X']`,
    `var jwtSigningSecret = "${HIGH_ENTROPY_VALUE}"; Environment.GetEnvironmentVariable("X");`,
  ];
  for (const content of cases) {
    assert.equal(scanSourceForSecrets(content, "src/auth.ts", resolve).length, 0, content);
  }
});

// ─── 6. UUID -> not detected ────────────────────────────────────────────────

test("a UUID-shaped value is not detected even in crypto-adjacent context", () => {
  const content = `const encryptionKey = "550e8400-e29b-41d4-a716-446655440000";`;
  assert.equal(scanSourceForSecrets(content, "src/auth.ts", resolve).length, 0);
});

// ─── 7. "changeme123" -> not detected ──────────────────────────────────────

test('"changeme123" is not detected (fails the length gate; a longer changeme-* value also fails the placeholder gate)', () => {
  assert.equal(scanSourceForSecrets(`const jwtSigningSecret = "changeme123";`, "src/auth.ts", resolve).length, 0);
  const longer = `const jwtSigningSecret = "changeme-in-production-value-1234567";`;
  assert.equal(scanSourceForSecrets(longer, "src/auth.ts", resolve).length, 0);
});

// ─── 8. "your-secret-here" -> not detected ─────────────────────────────────

test('"your-secret-here" is not detected, including a longer variant that clears the length gate', () => {
  assert.equal(scanSourceForSecrets(`const jwtSigningSecret = "your-secret-here";`, "src/auth.ts", resolve).length, 0);
  const longer = `const jwtSigningSecret = "your-secret-here-please-replace-1234";`;
  assert.equal(scanSourceForSecrets(longer, "src/auth.ts", resolve).length, 0);
});

// ─── 9. PEM private key -> not detected by secret detector ────────────────

test("PEM private key material is excluded — deferred to cert/key detection", () => {
  const content = `const privateKey = "-----BEGIN PRIVATE KEY-----MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcw";`;
  assert.equal(scanSourceForSecrets(content, "src/auth.ts", resolve).length, 0);
});

// ─── 10. ordinary password variable with low-entropy value -> not detected ─

test("an ordinary password variable is never flagged — bare secret-shaped identifiers don't qualify as crypto-adjacent", () => {
  const content = `const password = "hunter2hunter2";`;
  assert.equal(scanSourceForSecrets(content, "src/auth.ts", resolve).length, 0);
});

// ─── 11. high-entropy value in clearly non-crypto context -> not detected ─

test("a high-entropy value assigned to a non-crypto-adjacent identifier is not detected", () => {
  const content = `const sessionId = "${HIGH_ENTROPY_VALUE}";`;
  assert.equal(scanSourceForSecrets(content, "src/session.ts", resolve).length, 0);
});

// ─── generated/build file, node_modules, lockfile (12-14) ─────────────────

test("looksGenerated() recognises a DO-NOT-EDIT-style header", () => {
  assert.equal(looksGenerated("// Code generated by prisma-client-js. DO NOT EDIT.\nexport const x = 1;"), true);
  assert.equal(looksGenerated(`const jwtSigningSecret = "${HIGH_ENTROPY_VALUE}";`), false);
});

test("a generated file is never scanned end-to-end", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "ecdat-secrets-"));
  try {
    await mkdir(path.join(dir, "src", "generated"), { recursive: true });
    await writeFile(
      path.join(dir, "src", "generated", "client.ts"),
      `// This file is auto-generated. DO NOT EDIT.\nconst jwtSigningSecret = "${HIGH_ENTROPY_VALUE}";\n`
    );
    const { detections } = await scanFilesForSecrets(dir);
    assert.equal(detections.length, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("node_modules is never scanned", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "ecdat-secrets-"));
  try {
    await mkdir(path.join(dir, "node_modules", "some-pkg"), { recursive: true });
    await writeFile(
      path.join(dir, "node_modules", "some-pkg", "index.js"),
      `const jwtSigningSecret = "${HIGH_ENTROPY_VALUE}";\n`
    );
    const files = await discoverSecretScanFiles(dir);
    assert.equal(files.length, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("lockfiles are excluded from discovery", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "ecdat-secrets-"));
  try {
    await writeFile(path.join(dir, "package-lock.json"), `{"jwtSigningSecret": "${HIGH_ENTROPY_VALUE}"}`);
    const files = await discoverSecretScanFiles(dir);
    assert.equal(files.length, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// ─── 15-16. raw secret never leaks ─────────────────────────────────────────

test("the raw secret value never appears anywhere in a returned detection", () => {
  const content = `const jwtSigningSecret = "${HIGH_ENTROPY_VALUE}";`;
  const results = scanSourceForSecrets(content, "src/auth.ts", resolve);
  assert.equal(results.length, 1);
  const serialized = JSON.stringify(results);
  assert.equal(serialized.includes(HIGH_ENTROPY_VALUE), false);
});

test("the raw secret value never appears in the safe representation or fingerprint inputs", () => {
  const { safeName, fullHashHex } = safeSecretRepresentation(HIGH_ENTROPY_VALUE);
  assert.equal(safeName.includes(HIGH_ENTROPY_VALUE), false);
  assert.equal(fullHashHex.includes(HIGH_ENTROPY_VALUE), false);
  // Only an explicitly-sanctioned 4-character preview may appear, never the complete value.
  assert.equal(safeName.startsWith(`SECRET_${HIGH_ENTROPY_VALUE.slice(0, 4)}_`), true);
});

// ─── 17-18. fingerprint determinism / stable identity ──────────────────────

test("fingerprint is deterministic for the same value at the same location", () => {
  const content = `const jwtSigningSecret = "${HIGH_ENTROPY_VALUE}";`;
  const a = scanSourceForSecrets(content, "src/auth.ts", resolve);
  const b = scanSourceForSecrets(content, "src/auth.ts", resolve);
  assert.equal(a[0].fingerprint, b[0].fingerprint);
});

// ─── 19. changed secret -> different fingerprint ───────────────────────────

test("a different secret value at the same location produces a different fingerprint", () => {
  const other = "1a2b3c4d5e6f7089a1b2c3d4e5f60718";
  const a = scanSourceForSecrets(`const jwtSigningSecret = "${HIGH_ENTROPY_VALUE}";`, "src/auth.ts", resolve);
  const b = scanSourceForSecrets(`const jwtSigningSecret = "${other}";`, "src/auth.ts", resolve);
  assert.notEqual(a[0].fingerprint, b[0].fingerprint);
});

// ─── 20. multiple secrets independently detected ───────────────────────────

test("multiple distinct secrets on different lines are each detected independently", () => {
  const other = "1a2b3c4d5e6f7089a1b2c3d4e5f60718";
  const content = [`const jwtSigningSecret = "${HIGH_ENTROPY_VALUE}";`, `const hmacSecret = "${other}";`].join("\n");
  const results = scanSourceForSecrets(content, "src/auth.ts", resolve);

  assert.equal(results.length, 2);
  assert.notEqual(results[0].fingerprint, results[1].fingerprint);
  assert.deepEqual(
    results.map((r) => r.lineNumber),
    [1, 2]
  );
});

// ─── template literal interpolation is not a hardcoded secret ─────────────

test("a template literal with interpolation is never treated as a hardcoded value", () => {
  const content = "const jwtSigningSecret = `${dynamicPart}AAAAAAAAAAAAAAAAAAAA`;";
  assert.equal(scanSourceForSecrets(content, "src/auth.ts", resolve).length, 0);
});
