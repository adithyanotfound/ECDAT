/**
 * CRSF (Cryptographic Risk Scoring Factor) — Phase 4, Step 5.
 *
 * A deterministic, weighted 0-100 score. Every weight is a named constant
 * below — there are no unexplained magic numbers inline in the formula.
 *
 * Weighting rationale:
 *
 *   1. QUANTUM_VULNERABLE_BASE_POINTS   — any non-quantum-safe primitive
 *      carries some quantum risk, symmetric or not (Grover's algorithm at
 *      minimum halves effective symmetric strength).
 *   2. QUANTUM_VULNERABLE_ASYMMETRIC_BONUS — asymmetric (factoring /
 *      discrete-log) algorithms get a much larger bonus on top: Shor's
 *      algorithm doesn't just weaken them, it breaks them completely,
 *      regardless of key size.
 *   3. KEY_LENGTH_BELOW_FLOOR_POINTS    — RSA/DSA below 2048 bits or an EC
 *      curve below 224 bits fails the *classical* NIST SP 800-131A floor
 *      too — a second, independent risk axis from quantum vulnerability.
 *   4. Deprecated/weak algorithm points, from the shared NIST SP 800-131A
 *      transition table (deprecated-algorithms.ts) — disallowed/legacy
 *      algorithms add risk, recommended modern ones subtract a little.
 *   5. USAGE_COUNT_POINTS_PER_EXTRA_USE — higher usage means a weak
 *      primitive is harder/riskier to migrate away from; capped so one
 *      very hot call site can't dominate the score.
 *   6. CRITICALITY_POINTS               — the same weak primitive is a
 *      bigger problem in a CRITICAL repository than a LOW one.
 *
 * Deterministic: no Math.random(), no timestamps, no I/O. The same
 * ScoringInput always produces the same score.
 */
import { getCurveBitSize, lookupTransitionStatus } from "./deprecated-algorithms";
import type { RepositoryCriticality, RiskCategory, ScoringInput } from "./types";

// Exact category strings and thresholds the dashboard/UI depend on — do not rename or recase.
const CRITICAL_THRESHOLD = 70;
const HIGH_THRESHOLD = 45;
const MODERATE_THRESHOLD = 20;
const LOW_THRESHOLD = 5;

const QUANTUM_VULNERABLE_BASE_POINTS = 15;
const QUANTUM_VULNERABLE_ASYMMETRIC_BONUS = 33;
const KEY_LENGTH_BELOW_FLOOR_POINTS = 25;

const RSA_DSA_MIN_KEY_BITS = 2048;
const EC_MIN_CURVE_BITS = 224;

const DEPRECATED_STATUS_POINTS: Record<string, number> = {
  disallowed: 70,
  legacy: 35,
  acceptable: 0,
  recommended: -15,
};

const USAGE_COUNT_POINTS_PER_EXTRA_USE = 2;
const USAGE_COUNT_MAX_BONUS = 10;

const CRITICALITY_POINTS: Record<RepositoryCriticality, number> = {
  CRITICAL: 10,
  HIGH: 5,
  MEDIUM: 0,
  LOW: -5,
};

/** Algorithm-family labels (as produced by detectors/normalize.ts) that are asymmetric (factoring/discrete-log/ECC-based). */
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

const RSA_DSA_LIKE = new Set(["RSA", "RSA-PSS", "RSA-OAEP", "DSA"]);

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function computeCrsfScore(input: ScoringInput): number {
  const algo = (input.algorithm ?? "").toUpperCase();
  const isAsymmetric = ASYMMETRIC_ALGORITHMS.has(algo) || input.curve != null;
  const isQuantumVulnerable = input.quantumSafe === false;

  let score = 0;

  // Factors 1 & 2: quantum vulnerability, with an asymmetric-specific bonus.
  if (isQuantumVulnerable) {
    score += QUANTUM_VULNERABLE_BASE_POINTS;
    if (isAsymmetric) {
      score += QUANTUM_VULNERABLE_ASYMMETRIC_BONUS;
    }
  }

  // Factor 3: classical key-length / curve-size floor (independent of quantum safety).
  if (input.keyLengthBits != null && RSA_DSA_LIKE.has(algo) && input.keyLengthBits < RSA_DSA_MIN_KEY_BITS) {
    score += KEY_LENGTH_BELOW_FLOOR_POINTS;
  }
  if (input.curve != null) {
    const curveBits = getCurveBitSize(input.curve);
    if (curveBits != null && curveBits < EC_MIN_CURVE_BITS) {
      score += KEY_LENGTH_BELOW_FLOOR_POINTS;
    }
  }

  // Factor 4: NIST SP 800-131A transition status.
  const transition = lookupTransitionStatus({
    algorithm: input.algorithm,
    keyLengthBits: input.keyLengthBits,
    curve: input.curve,
  });
  if (transition) {
    score += DEPRECATED_STATUS_POINTS[transition.status] ?? 0;
  }

  // Factor 5: usage count — migration exposure, capped.
  const extraUses = Math.max(input.usageCount - 1, 0);
  score += Math.min(extraUses * USAGE_COUNT_POINTS_PER_EXTRA_USE, USAGE_COUNT_MAX_BONUS);

  // Factor 6: repository criticality.
  score += CRITICALITY_POINTS[input.repositoryCriticality];

  return clamp(Math.round(score), 0, 100);
}

/**
 * Exactly the five strings ("SAFE" | "LOW" | "MODERATE" | "HIGH" | "CRITICAL")
 * the dashboard/UI depend on — see src/server/db/dashboard.ts's
 * cryptographicPosture mapping, which already accounts for all five.
 */
export function deriveRiskCategory(crsfScore: number): RiskCategory {
  if (crsfScore >= CRITICAL_THRESHOLD) return "CRITICAL";
  if (crsfScore >= HIGH_THRESHOLD) return "HIGH";
  if (crsfScore >= MODERATE_THRESHOLD) return "MODERATE";
  if (crsfScore >= LOW_THRESHOLD) return "LOW";
  return "SAFE";
}
