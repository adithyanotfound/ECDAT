/**
 * Mosca's inequality — Phase 4, Step 5.
 *
 *   X (data lifetime) + Y (migration time) > Z (time to CRQC)  =>  act now
 *
 * X: Repository.dataLifetimeYears, supplied by the caller (engine.ts) —
 *    this module never queries the database itself.
 * Y: a deterministic migration-time heuristic (see computeMoscaY below) —
 *    explicitly NOT a scientifically precise estimate, just a documented,
 *    configurable approximation.
 * Z: a configurable CRQC (cryptographically-relevant quantum computer)
 *    arrival horizon, read from `CRQC_ARRIVAL_YEAR` (default year 2033,
 *    matching IMPLEMENTATION_PLAN.md's own default). Set the
 *    `CRQC_ARRIVAL_YEAR` environment variable to override the assumed
 *    arrival year for this deployment.
 */
import type { MoscaVerdict, ScoringInput } from "./types";

const DEFAULT_CRQC_ARRIVAL_YEAR = 2033;
/** Z is never allowed to go negative/zero from a misconfigured or past-dated env var. */
const MIN_MOSCA_Z_YEARS = 0;

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

// Y heuristic constants — deliberately simple and named, not a precision estimate.
const MOSCA_Y_BASE_YEARS = 1;
const MOSCA_Y_ASYMMETRIC_BONUS_YEARS = 2;
const MOSCA_Y_HIGH_USAGE_BONUS_YEARS = 1;
const MOSCA_Y_HIGH_USAGE_THRESHOLD = 10;
const MOSCA_Y_MAX_YEARS = 5;

export interface MoscaResult {
  moscaX: number;
  moscaY: number;
  moscaZ: number;
  moscaVerdict: MoscaVerdict;
}

/** Resolves Z: `CRQC_ARRIVAL_YEAR` env var minus the current year, defaulting to 2033. */
export function computeMoscaZ(now: Date = new Date()): number {
  const currentYear = now.getUTCFullYear();
  const envValue = process.env.CRQC_ARRIVAL_YEAR;
  const parsed = envValue ? Number.parseInt(envValue, 10) : NaN;
  const arrivalYear = Number.isFinite(parsed) ? parsed : DEFAULT_CRQC_ARRIVAL_YEAR;
  return Math.max(arrivalYear - currentYear, MIN_MOSCA_Z_YEARS);
}

/**
 * Deterministic migration-time heuristic, NOT a scientifically precise
 * estimate: quantum-safe assets need no migration (0); quantum-vulnerable
 * asymmetric algorithms get a longer estimate than a low-usage classical
 * hash, and heavy usage adds more (larger blast radius to migrate).
 */
export function computeMoscaY(input: ScoringInput): number {
  if (input.quantumSafe === true) return 0;

  const algo = (input.algorithm ?? "").toUpperCase();
  const isAsymmetric = ASYMMETRIC_ALGORITHMS.has(algo) || input.curve != null;

  let years = MOSCA_Y_BASE_YEARS;
  if (isAsymmetric) years += MOSCA_Y_ASYMMETRIC_BONUS_YEARS;
  if (input.usageCount >= MOSCA_Y_HIGH_USAGE_THRESHOLD) years += MOSCA_Y_HIGH_USAGE_BONUS_YEARS;

  return Math.min(years, MOSCA_Y_MAX_YEARS);
}

export function computeMoscaVerdict(input: ScoringInput, now: Date = new Date()): MoscaResult {
  const moscaX = Math.max(input.repositoryDataLifetimeYears, 0);
  const moscaY = computeMoscaY(input);
  const moscaZ = computeMoscaZ(now);

  let moscaVerdict: MoscaVerdict;
  if (input.quantumSafe === true) {
    moscaVerdict = "SAFE";
  } else if (moscaX + moscaY > moscaZ) {
    moscaVerdict = "ACT_NOW";
  } else {
    moscaVerdict = "PLAN";
  }

  return { moscaX, moscaY, moscaZ, moscaVerdict };
}
