/**
 * Focused tests for the risk scoring engine — Phase 4, Step 5.
 *
 * Uses Node's built-in test runner (no new devDependency), mirroring the
 * detector test files. These test the pure scoring functions directly with
 * synthetic ScoringInput values — no Prisma, no database.
 *
 * Run with:
 *   npx tsx --test src/server/scoring/scoring.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { computeCrsfScore, deriveRiskCategory } from "./crsf";
import { computePqcSafetyScore } from "./pqc";
import { computeCisConformance } from "./cis";
import { computeMoscaVerdict, computeMoscaZ } from "./mosca";
import type { ScoringInput } from "./types";

function makeInput(overrides: Partial<ScoringInput> = {}): ScoringInput {
  return {
    kind: "ALGORITHM",
    algorithm: null,
    keyLengthBits: null,
    quantumSafe: null,
    curve: null,
    usageCount: 1,
    repositoryCriticality: "MEDIUM",
    repositoryDataLifetimeYears: 5,
    ...overrides,
  };
}

const FIXED_NOW = new Date("2026-01-01T00:00:00Z"); // currentYear = 2026 for every Mosca test below

// ─── Test 1 — 3DES ──────────────────────────────────────────────────────────

test("3DES: CRSF is approximately 85 (matches the implementation-plan marker vocabulary), quantumSafe false", () => {
  const input = makeInput({ algorithm: "3DES", keyLengthBits: 168, quantumSafe: false });
  assert.equal(input.quantumSafe, false);
  assert.equal(computeCrsfScore(input), 85);
});

// ─── Test 2 — synthetic ML-KEM-768 ──────────────────────────────────────────

test("synthetic ML-KEM-768 input: CRSF=0, PQC>=9 (no real detector produces this yet — see pqc.ts)", () => {
  // SYNTHETIC: neither the JS/TS call-site detector (Step 2) nor the
  // certificate/key detector (Step 4) can currently produce a real
  // ML-KEM/ML-DSA/SLH-DSA asset. This input exists purely to exercise the
  // top of the PQC scoring scale, per pqc.ts's documented expectation.
  const input = makeInput({ algorithm: "ML-KEM-768", keyLengthBits: 768, quantumSafe: true });
  assert.equal(computeCrsfScore(input), 0);
  assert.ok(computePqcSafetyScore(input) >= 9);
});

// ─── Test 3 — RSA-2048 ──────────────────────────────────────────────────────

test("RSA-2048: CRSF is approximately 48", () => {
  const input = makeInput({ algorithm: "RSA", keyLengthBits: 2048, quantumSafe: false });
  const crsf = computeCrsfScore(input);
  assert.ok(Math.abs(crsf - 48) <= 5, `expected CRSF within 5 points of 48, got ${crsf}`);
});

// ─── Tests 4-6 — Mosca branches ─────────────────────────────────────────────

test("Mosca SAFE branch: quantumSafe true always yields SAFE with moscaY=0, regardless of X/Z", () => {
  const input = makeInput({ quantumSafe: true, repositoryDataLifetimeYears: 50 });
  const result = computeMoscaVerdict(input, FIXED_NOW);
  assert.equal(result.moscaVerdict, "SAFE");
  assert.equal(result.moscaY, 0);
});

test("Mosca PLAN branch: X + Y <= Z", () => {
  const input = makeInput({ quantumSafe: false, algorithm: "SHA-1", repositoryDataLifetimeYears: 1 });
  const result = computeMoscaVerdict(input, FIXED_NOW);
  assert.equal(result.moscaZ, 7); // default 2033 - 2026
  assert.ok(result.moscaX + result.moscaY <= result.moscaZ);
  assert.equal(result.moscaVerdict, "PLAN");
});

test("Mosca ACT_NOW branch: X + Y > Z", () => {
  const input = makeInput({
    quantumSafe: false,
    algorithm: "RSA",
    keyLengthBits: 1024,
    repositoryDataLifetimeYears: 10,
    usageCount: 15,
  });
  const result = computeMoscaVerdict(input, FIXED_NOW);
  assert.ok(result.moscaX + result.moscaY > result.moscaZ);
  assert.equal(result.moscaVerdict, "ACT_NOW");
});

test("Mosca Z reads CRQC_ARRIVAL_YEAR from the environment, defaulting to 2033, never going negative", () => {
  const original = process.env.CRQC_ARRIVAL_YEAR;
  try {
    delete process.env.CRQC_ARRIVAL_YEAR;
    assert.equal(computeMoscaZ(FIXED_NOW), 7); // 2033 - 2026

    process.env.CRQC_ARRIVAL_YEAR = "2030";
    assert.equal(computeMoscaZ(FIXED_NOW), 4);

    process.env.CRQC_ARRIVAL_YEAR = "not-a-number";
    assert.equal(computeMoscaZ(FIXED_NOW), 7); // invalid config falls back to the default

    process.env.CRQC_ARRIVAL_YEAR = "2000"; // in the past relative to FIXED_NOW
    assert.equal(computeMoscaZ(FIXED_NOW), 0); // clamped, never negative
  } finally {
    if (original === undefined) delete process.env.CRQC_ARRIVAL_YEAR;
    else process.env.CRQC_ARRIVAL_YEAR = original;
  }
});

// ─── Test 7 — risk-category boundaries ─────────────────────────────────────

test("risk-category boundaries match the exact specified thresholds", () => {
  assert.equal(deriveRiskCategory(0), "SAFE");
  assert.equal(deriveRiskCategory(4), "SAFE");
  assert.equal(deriveRiskCategory(5), "LOW");
  assert.equal(deriveRiskCategory(19), "LOW");
  assert.equal(deriveRiskCategory(20), "MODERATE");
  assert.equal(deriveRiskCategory(44), "MODERATE");
  assert.equal(deriveRiskCategory(45), "HIGH");
  assert.equal(deriveRiskCategory(69), "HIGH");
  assert.equal(deriveRiskCategory(70), "CRITICAL");
  assert.equal(deriveRiskCategory(100), "CRITICAL");
});

// ─── Test 8 — unknown algorithm CIS behavior ───────────────────────────────

test("an algorithm absent from the NIST transition table gets a neutral CIS score, never reported as safe", () => {
  const input = makeInput({ algorithm: "FROBNICATE-9000" });
  const { cisScore, cisExplanation } = computeCisConformance(input);
  assert.equal(cisScore, 50);
  assert.ok(cisExplanation.toLowerCase().includes("not present"));
});

test("a known-recommended algorithm scores highest on CIS with its real explanation", () => {
  const input = makeInput({ algorithm: "Ed25519" });
  const { cisScore, cisExplanation } = computeCisConformance(input);
  assert.equal(cisScore, 100);
  assert.ok(cisExplanation.length > 0);
});

// ─── Test 9 — quantum-safe PQC scoring ─────────────────────────────────────

test("a quantum-safe symmetric primitive scores in the 7-10 range", () => {
  const input = makeInput({ algorithm: "AES-256-GCM", quantumSafe: true });
  const score = computePqcSafetyScore(input);
  assert.ok(score >= 7 && score <= 10, `expected 7-10, got ${score}`);
});

test("a quantum-vulnerable asset scores 0-4 on PQC safety", () => {
  const input = makeInput({ algorithm: "RSA", quantumSafe: false, keyLengthBits: 2048 });
  const score = computePqcSafetyScore(input);
  assert.ok(score >= 0 && score <= 4, `expected 0-4, got ${score}`);
});

test("unknown quantum-safety (null, e.g. a general-purpose library) scores a neutral value", () => {
  const input = makeInput({ quantumSafe: null });
  assert.equal(computePqcSafetyScore(input), 5);
});

// ─── Test 10 — usageCount effect on CRSF/MOSCA, deterministically ─────────

test("high usageCount increases CRSF and MOSCA Y, and every computation is deterministic", () => {
  const low = makeInput({ algorithm: "RSA", keyLengthBits: 2048, quantumSafe: false, usageCount: 1 });
  const high = makeInput({ algorithm: "RSA", keyLengthBits: 2048, quantumSafe: false, usageCount: 20 });

  const crsfLow = computeCrsfScore(low);
  const crsfHigh = computeCrsfScore(high);
  assert.ok(crsfHigh > crsfLow);
  assert.equal(computeCrsfScore(high), crsfHigh); // repeat call, same result

  const moscaLow = computeMoscaVerdict(low, FIXED_NOW);
  const moscaHigh = computeMoscaVerdict(high, FIXED_NOW);
  assert.ok(moscaHigh.moscaY >= moscaLow.moscaY);
});

test("every scoring function is deterministic for identical inputs", () => {
  const input = makeInput({
    algorithm: "RSA",
    keyLengthBits: 2048,
    quantumSafe: false,
    usageCount: 5,
    repositoryCriticality: "HIGH",
  });

  const runOnce = () => ({
    crsf: computeCrsfScore(input),
    pqc: computePqcSafetyScore(input),
    cis: computeCisConformance(input),
    mosca: computeMoscaVerdict(input, FIXED_NOW),
  });

  assert.deepEqual(runOnce(), runOnce());
});
