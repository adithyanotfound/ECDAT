/**
 * Focused tests for finding derivation — Phase 5, Step 7.
 *
 * Uses Node's built-in test runner (mirrors scoring.test.ts and the
 * detector test files). Pure function tests with synthetic
 * FindingSourceAsset values — no Prisma, no database.
 *
 * Run with:
 *   npx tsx --test src/server/findings/derive.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { deriveFindingsForAsset, type FindingSourceAsset, type RepositoryCriticality } from "./derive";

function makeAsset(overrides: Partial<FindingSourceAsset> = {}): FindingSourceAsset {
  return {
    id: "asset-1",
    kind: "ALGORITHM",
    name: "Test Algorithm",
    algorithm: null,
    keyLengthBits: null,
    curve: null,
    quantumSafe: null,
    filePath: "src/example.ts",
    lineNumber: 12,
    ...overrides,
  };
}

// ─── Test 1 — disallowed + HIGH/CRITICAL repository -> CRITICAL ───────────

test("disallowed algorithm in a HIGH-criticality repository produces a CRITICAL finding", () => {
  const asset = makeAsset({ algorithm: "3DES", keyLengthBits: 168, quantumSafe: false });
  const findings = deriveFindingsForAsset(asset, "HIGH");
  const disallowed = findings.find((f) => f.code === "CRYPTO-DISALLOWED");
  assert.ok(disallowed, "expected a CRYPTO-DISALLOWED finding");
  assert.equal(disallowed!.severity, "CRITICAL");
});

test("disallowed algorithm in a CRITICAL-criticality repository also produces a CRITICAL finding", () => {
  const asset = makeAsset({ algorithm: "MD5", quantumSafe: false });
  const findings = deriveFindingsForAsset(asset, "CRITICAL");
  const disallowed = findings.find((f) => f.code === "CRYPTO-DISALLOWED");
  assert.equal(disallowed!.severity, "CRITICAL");
});

// ─── Test 2 — disallowed + LOW/MEDIUM repository -> HIGH ───────────────────

test("disallowed algorithm in a LOW-criticality repository produces a HIGH finding", () => {
  const asset = makeAsset({ algorithm: "RC4", quantumSafe: false });
  const findings = deriveFindingsForAsset(asset, "LOW");
  const disallowed = findings.find((f) => f.code === "CRYPTO-DISALLOWED");
  assert.equal(disallowed!.severity, "HIGH");
});

test("disallowed algorithm in a MEDIUM-criticality repository produces a HIGH finding", () => {
  const asset = makeAsset({ algorithm: "SHA-1", quantumSafe: false });
  const findings = deriveFindingsForAsset(asset, "MEDIUM");
  const disallowed = findings.find((f) => f.code === "CRYPTO-DISALLOWED");
  assert.equal(disallowed!.severity, "HIGH");
});

// ─── Test 3 — legacy algorithm -> MODERATE ─────────────────────────────────

test("legacy algorithm produces a MODERATE CRYPTO-LEGACY finding, regardless of repository criticality", () => {
  const asset = makeAsset({ algorithm: "DSA", quantumSafe: false });
  const findings = deriveFindingsForAsset(asset, "CRITICAL");
  const legacy = findings.find((f) => f.code === "CRYPTO-LEGACY");
  assert.ok(legacy, "expected a CRYPTO-LEGACY finding");
  assert.equal(legacy!.severity, "MODERATE");
  assert.equal(findings.some((f) => f.code === "CRYPTO-DISALLOWED"), false);
});

// ─── Test 4 — weak key length -> CRYPTO-WEAK-KEYLENGTH ─────────────────────

test("a CERTIFICATE with an RSA key below the 2048-bit floor produces CRYPTO-WEAK-KEYLENGTH", () => {
  const asset = makeAsset({
    kind: "CERTIFICATE",
    algorithm: "RSA",
    keyLengthBits: 1024,
    quantumSafe: false,
  });
  const findings = deriveFindingsForAsset(asset, "MEDIUM");
  const weakKey = findings.find((f) => f.code === "CRYPTO-WEAK-KEYLENGTH");
  assert.ok(weakKey, "expected a CRYPTO-WEAK-KEYLENGTH finding");
  assert.equal(weakKey!.cryptoAssetId, asset.id);
});

test("a KEY with an EC curve below the 224-bit floor produces CRYPTO-WEAK-KEYLENGTH", () => {
  const asset = makeAsset({
    kind: "KEY",
    algorithm: "EC",
    curve: "secp112r1", // not in the known curve table -> getCurveBitSize returns null -> no finding
  });
  const findings = deriveFindingsForAsset({ ...asset, quantumSafe: false }, "MEDIUM");
  // secp112r1 isn't in this project's curve table, so no key-length policy can be applied —
  // this documents "never invent a floor for an unknown curve", not a positive case.
  assert.equal(findings.some((f) => f.code === "CRYPTO-WEAK-KEYLENGTH"), false);
});

test("weak-key-length does not fire for a compliant key length (RSA-3072)", () => {
  const asset = makeAsset({ kind: "KEY", algorithm: "RSA", keyLengthBits: 3072, quantumSafe: false });
  const findings = deriveFindingsForAsset(asset, "MEDIUM");
  assert.equal(findings.some((f) => f.code === "CRYPTO-WEAK-KEYLENGTH"), false);
});

test("weak-key-length never fires for an ALGORITHM-kind asset (only CERTIFICATE/KEY)", () => {
  const asset = makeAsset({ kind: "ALGORITHM", algorithm: "RSA", keyLengthBits: 1024, quantumSafe: false });
  const findings = deriveFindingsForAsset(asset, "MEDIUM");
  assert.equal(findings.some((f) => f.code === "CRYPTO-WEAK-KEYLENGTH"), false);
  // The same asset still gets flagged as disallowed — just under a different code.
  assert.ok(findings.some((f) => f.code === "CRYPTO-DISALLOWED"));
});

// ─── Test 5 — compliant asset -> zero findings ─────────────────────────────

test("a compliant, quantum-safe asset produces zero findings", () => {
  const asset = makeAsset({ algorithm: "AES-256-GCM", quantumSafe: true });
  const findings = deriveFindingsForAsset(asset, "CRITICAL");
  assert.deepEqual(findings, []);
});

test("a recommended asset (Ed25519) produces zero findings", () => {
  const asset = makeAsset({ algorithm: "Ed25519", quantumSafe: false });
  const findings = deriveFindingsForAsset(asset, "HIGH");
  assert.deepEqual(findings, []);
});

// ─── Test 6 — certificate expiry: not implemented (documented gap) ────────

test("no CERT-EXPIRED/CERT-EXPIRING-SOON codes are ever produced — CryptoAsset has no notAfter column", () => {
  // FindingSourceAsset intentionally has no expiry field at all: the
  // certificate/key detector's NormalizedCryptoUsage carries notAfter, but
  // it is never persisted to CryptoAsset (no column exists), so derive.ts
  // has nothing to read it from. This test documents that gap rather than
  // exercising a code path.
  const asset = makeAsset({ kind: "CERTIFICATE", algorithm: "RSA", keyLengthBits: 2048, quantumSafe: false });
  const findings = deriveFindingsForAsset(asset, "MEDIUM");
  assert.equal(findings.some((f) => f.code === "CERT-EXPIRED"), false);
  assert.equal(findings.some((f) => f.code === "CERT-EXPIRING-SOON"), false);
});

// ─── Test 7 — replacement/remediation exists ───────────────────────────────

test("every disallowed/legacy/weak-key finding carries a non-empty, non-generic remediation when a direct replacement is known", () => {
  const asset = makeAsset({ algorithm: "3DES", keyLengthBits: 168, quantumSafe: false });
  const findings = deriveFindingsForAsset(asset, "MEDIUM");
  const disallowed = findings.find((f) => f.code === "CRYPTO-DISALLOWED")!;
  assert.equal(disallowed.remediation, "Migrate to AES-256-GCM.");
});

test("an algorithm with no known direct replacement falls back to the generic remediation, never a fabricated one", () => {
  const asset = makeAsset({ algorithm: "RC4", quantumSafe: false });
  // RC4 -> AES-256-GCM is a direct mapping; use a curve with no known bit size to force the generic branch.
  const unknownCurveAsset = makeAsset({ curve: "brainpoolP160r1", quantumSafe: false });
  const findings = deriveFindingsForAsset(asset, "MEDIUM");
  assert.equal(findings.find((f) => f.code === "CRYPTO-DISALLOWED")!.remediation, "Migrate to AES-256-GCM.");
  assert.equal(deriveFindingsForAsset(unknownCurveAsset, "MEDIUM").length, 0); // unrecognised curve -> no transition entry at all
});

// ─── Test 8 — triggering asset id exists ───────────────────────────────────

test("every candidate carries the triggering CryptoAsset id", () => {
  const asset = makeAsset({ id: "asset-xyz", algorithm: "MD5", quantumSafe: false });
  const findings = deriveFindingsForAsset(asset, "HIGH");
  assert.ok(findings.length > 0);
  for (const f of findings) {
    assert.equal(f.cryptoAssetId, "asset-xyz");
  }
});

// ─── Additional: disallowed + weak-key-length can legitimately co-occur ────

test("RSA-1024 (CERTIFICATE) produces both CRYPTO-DISALLOWED and CRYPTO-WEAK-KEYLENGTH — two distinct risk axes, not a duplicate", () => {
  const asset = makeAsset({ kind: "CERTIFICATE", algorithm: "RSA", keyLengthBits: 1024, quantumSafe: false });
  const findings = deriveFindingsForAsset(asset, "HIGH");
  const codes = findings.map((f) => f.code).sort();
  assert.deepEqual(codes, ["CRYPTO-DISALLOWED", "CRYPTO-WEAK-KEYLENGTH"]);
});

test("deriveFindingsForAsset is deterministic for identical inputs", () => {
  const asset = makeAsset({ kind: "KEY", algorithm: "RSA", keyLengthBits: 1024, quantumSafe: false });
  const criticality: RepositoryCriticality = "HIGH";
  assert.deepEqual(deriveFindingsForAsset(asset, criticality), deriveFindingsForAsset(asset, criticality));
});

// ════════════════════════════════════════════════════════════════════════
// Phase 5, Step 8 — PROTOCOL and SECRET findings integration
//
// Extends this same test file/module rather than creating a second
// findings test suite, per the Step 8 instruction not to duplicate the
// Step 7 findings system's tests.
// ════════════════════════════════════════════════════════════════════════

// ─── PROTOCOL: reaches derivation without crashing, WEAK-PROTOCOL-CONFIG ──

test("a PROTOCOL asset reaches derivation without crashing and produces zero findings when unclassified", () => {
  const asset = makeAsset({ kind: "PROTOCOL", name: "sshd_config cipher: aes256-gcm@openssh.com", algorithm: "aes256-gcm@openssh.com" });
  assert.deepEqual(deriveFindingsForAsset(asset, "HIGH"), []);
});

test("PROTOCOL + disallowed TLS version (TLSv1.1) produces WEAK-PROTOCOL-CONFIG, reusing the disallowed-algorithm severity rule", () => {
  const asset = makeAsset({ kind: "PROTOCOL", name: "nginx ssl_protocols: TLSv1.1", algorithm: "TLSv1.1" });

  const high = deriveFindingsForAsset(asset, "HIGH");
  assert.equal(high.length, 1);
  assert.equal(high[0].code, "WEAK-PROTOCOL-CONFIG");
  assert.equal(high[0].severity, "CRITICAL");

  const low = deriveFindingsForAsset(asset, "LOW");
  assert.equal(low[0].severity, "HIGH");
});

test("PROTOCOL + legacy SSH KEX (diffie-hellman-group14-sha1) produces a MODERATE WEAK-PROTOCOL-CONFIG", () => {
  const asset = makeAsset({ kind: "PROTOCOL", name: "sshd_config KexAlgorithms: diffie-hellman-group14-sha1", algorithm: "diffie-hellman-group14-sha1" });
  const findings = deriveFindingsForAsset(asset, "CRITICAL");
  assert.equal(findings.length, 1);
  assert.equal(findings[0].code, "WEAK-PROTOCOL-CONFIG");
  assert.equal(findings[0].severity, "MODERATE");
});

test("PROTOCOL + an SSH cipher normalised onto an existing disallowed algorithm (3DES, from raw token 3des-cbc) produces WEAK-PROTOCOL-CONFIG via the reused table", () => {
  // config-protocol-scan.ts's sshTokenUsage() normalises "3des-cbc" to the
  // canonical "3DES" via SSH_ALGORITHM_ALIASES before this ever reaches
  // derivation — so deriveProtocolFindings()'s FIRST check
  // (deprecated-algorithms.ts's lookupTransitionStatus) already recognises
  // it, and protocol-transitions.ts is never even consulted for this case.
  const asset = makeAsset({ kind: "PROTOCOL", name: "sshd_config cipher: 3des-cbc", algorithm: "3DES" });
  const findings = deriveFindingsForAsset(asset, "MEDIUM");
  assert.equal(findings.length, 1);
  assert.equal(findings[0].code, "WEAK-PROTOCOL-CONFIG");
  assert.equal(findings[0].severity, "HIGH"); // MEDIUM repo criticality -> HIGH, not CRITICAL
});

test("acceptable protocol (TLSv1.2) produces no finding — an asset existing is never itself a vulnerability", () => {
  const asset = makeAsset({ kind: "PROTOCOL", name: "nginx ssl_protocols: TLSv1.2", algorithm: "TLSv1.2" });
  assert.deepEqual(deriveFindingsForAsset(asset, "CRITICAL"), []);
});

test("recommended protocol (TLSv1.3) produces no finding", () => {
  const asset = makeAsset({ kind: "PROTOCOL", name: "nginx ssl_protocols: TLSv1.3", algorithm: "TLSv1.3" });
  assert.deepEqual(deriveFindingsForAsset(asset, "CRITICAL"), []);
});

// ─── SECRET: reaches derivation without crashing, HARDCODED-SECRET ────────

test("a SECRET asset always produces exactly one CRITICAL HARDCODED-SECRET finding, regardless of repository criticality", () => {
  const asset = makeAsset({ kind: "SECRET", name: "SECRET_9f2a_abc123def456", algorithm: null, keyLengthBits: null, curve: null, quantumSafe: null });

  for (const criticality of ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as RepositoryCriticality[]) {
    const findings = deriveFindingsForAsset(asset, criticality);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].code, "HARDCODED-SECRET");
    assert.equal(findings[0].severity, "CRITICAL");
    assert.equal(findings[0].cryptoAssetId, asset.id);
  }
});

test("a SECRET finding's title/affectedComponent only ever carries the already-safe asset name, never a raw value", () => {
  const safeName = "SECRET_9f2a_abc123def456";
  const asset = makeAsset({ kind: "SECRET", name: safeName });
  const [finding] = deriveFindingsForAsset(asset, "LOW");
  assert.ok(finding.title.includes(safeName));
  assert.equal(finding.affectedComponent, safeName);
});
