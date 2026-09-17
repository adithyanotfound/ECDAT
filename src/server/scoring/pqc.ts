/**
 * PQC (Post-Quantum Cryptography) safety score — Phase 4, Step 5.
 *
 * Integer 0-10 per asset.
 *
 * IMPORTANT — expected range coverage: the current JS/TS call-site
 * detector (Phase 4, Step 2) and certificate/key detector (Phase 4, Step 4)
 * cannot realistically produce true PQC-standard detections such as
 * ML-KEM, ML-DSA or SLH-DSA — no source-level rule or certificate OID table
 * in this codebase recognises those algorithms yet. This function still
 * reserves the top of the scale (PQC_STANDARD_MIN..10) for them so the
 * scale is meaningful once a future detector can produce them, but from
 * *today's* real detector output that band is mostly unreachable. That is
 * expected behavior, not a bug — see scoring.test.ts's synthetic ML-KEM-768
 * case, which exists precisely because no real detector can produce one.
 */
import type { ScoringInput } from "./types";

/** Recognised true PQC-standard algorithm name prefixes (FIPS 203/204/205). */
const PQC_STANDARD_PREFIXES = ["ML-KEM", "ML-DSA", "SLH-DSA"];

const PQC_STANDARD_SCORE = 10;
const PQC_STANDARD_SCORE_BONUS_THRESHOLD_BITS = 256; // e.g. ML-KEM-768/ML-DSA-65+ vs the smallest parameter sets
const PQC_STANDARD_SCORE_BASE = 9;

const SYMMETRIC_SAFE_SCORE = 7;
const SYMMETRIC_SAFE_SCORE_STRONG_BONUS = 1; // AEAD/256-bit constructions edge above the floor
const UNKNOWN_QUANTUM_SAFETY_SCORE = 5;

const QUANTUM_UNSAFE_BASE_SCORE = 4;
const QUANTUM_UNSAFE_ASYMMETRIC_PENALTY = 2;
const CRITICAL_REPO_PENALTY = 1;
const HIGH_USAGE_PENALTY = 1;
const HIGH_USAGE_THRESHOLD = 10;

const ASYMMETRIC_ALGORITHMS = new Set([
  "RSA",
  "RSA-PSS",
  "RSA-OAEP",
  "DSA",
  "EC",
  "ECDSA",
  "ECDH",
  "DH",
  "ED25519",
  "ED448",
  "X25519",
  "X448",
]);

/** AEAD/strong 256-bit-class symmetric constructions that sit slightly above the generic quantum-safe floor. */
const STRONG_SYMMETRIC_ALGORITHMS = new Set(["AES-256-GCM", "AES-256", "CHACHA20-POLY1305", "SHA-512", "SHA-384"]);

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function computePqcSafetyScore(input: ScoringInput): number {
  const algo = (input.algorithm ?? "").toUpperCase();

  if (input.quantumSafe === true) {
    const isPqcStandard = PQC_STANDARD_PREFIXES.some((prefix) => algo.startsWith(prefix));
    if (isPqcStandard) {
      const isHighParameterSet = (input.keyLengthBits ?? 0) >= PQC_STANDARD_SCORE_BONUS_THRESHOLD_BITS;
      return isHighParameterSet ? PQC_STANDARD_SCORE : PQC_STANDARD_SCORE_BASE;
    }
    const bonus = STRONG_SYMMETRIC_ALGORITHMS.has(algo) ? SYMMETRIC_SAFE_SCORE_STRONG_BONUS : 0;
    return clamp(SYMMETRIC_SAFE_SCORE + bonus, 0, 10);
  }

  if (input.quantumSafe === false) {
    let score = QUANTUM_UNSAFE_BASE_SCORE;
    if (ASYMMETRIC_ALGORITHMS.has(algo) || input.curve != null) {
      score -= QUANTUM_UNSAFE_ASYMMETRIC_PENALTY;
    }
    if (input.repositoryCriticality === "CRITICAL") {
      score -= CRITICAL_REPO_PENALTY;
    }
    if (input.usageCount >= HIGH_USAGE_THRESHOLD) {
      score -= HIGH_USAGE_PENALTY;
    }
    return clamp(score, 0, 4);
  }

  // quantumSafe === null: genuinely unknown (e.g. a manifest library whose
  // quantum-safety depends on runtime usage, or an unparsed PKCS#12/JKS
  // bundle) — neutral, not optimistic and not pessimistic.
  return UNKNOWN_QUANTUM_SAFETY_SCORE;
}
