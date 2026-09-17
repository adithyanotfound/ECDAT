/**
 * Shared scoring types — Phase 4, Step 5.
 *
 * Deliberately independent of Prisma and of src/server/detectors/types.ts:
 * the scoring engine's pure functions (crsf.ts, pqc.ts, cis.ts, mosca.ts)
 * take a small, self-contained input shape so they're trivially
 * unit-testable with synthetic data, matching the project's established
 * "pure module -> persistence/orchestration module" architecture.
 */

/** Mirrors Prisma's `Criticality` enum (prisma/schema.prisma) — not redefined there, just referenced by value here. */
export type RepositoryCriticality = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

/** The exact five strings the dashboard and UI expect — see src/server/db/dashboard.ts. */
export type RiskCategory = "SAFE" | "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

export type MoscaVerdict = "ACT_NOW" | "PLAN" | "SAFE";

/**
 * Everything a scoring pass needs about one CryptoAsset plus the repository
 * it belongs to. Built by src/server/scoring/engine.ts from a fetched
 * CryptoAsset + Repository row; never randomised, never timestamp-derived.
 */
export interface ScoringInput {
  kind: "ALGORITHM" | "CERTIFICATE" | "KEY" | "PROTOCOL" | "LIBRARY" | "SECRET";
  algorithm: string | null;
  keyLengthBits: number | null;
  quantumSafe: boolean | null;
  curve: string | null;
  usageCount: number;
  repositoryCriticality: RepositoryCriticality;
  repositoryDataLifetimeYears: number;
}

/** Maps 1:1 onto RiskAssessment's own columns (prisma/schema.prisma). */
export interface ScoringResult {
  crsfScore: number;
  cisScore: number;
  pqcSafetyScore: number;
  riskCategory: RiskCategory;
  moscaX: number;
  moscaY: number;
  moscaZ: number;
  moscaVerdict: MoscaVerdict;
  cisExplanation: string;
}
