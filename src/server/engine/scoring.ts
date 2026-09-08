/**
 * Scoring — CRSF, CIS, PQC safety, quantum readiness, and Mosca's inequality.
 * (IMPLEMENTATION_PLAN.md §4c)
 */
import type { NormalizedHit } from "./types";

export interface Criticality {
  value: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
}

/** NIST SP 800-57 classical-security-bit floor by asset class. */
const SEC_FLOOR = 112;

/**
 * CRSF (Cryptographic Risk Scoring Framework) 0-100.
 * Weighted over algorithm strength (quantum-vulnerable asymmetric dominates),
 * key length against the NIST floor, deprecation status, exposure, usage
 * count and the repository's data classification.
 */
export function computeCrsf(
  hit: NormalizedHit,
  opts: { usageCount: number; criticality: Criticality["value"] }
): number {
  let score = 0;

  // Base severity from the detector itself, if it flagged one directly.
  const baseSeverity: Record<string, number> = {
    CRITICAL: 90,
    HIGH: 70,
    MODERATE: 45,
    LOW: 20,
    COMPLIANT: 0,
  };
  if (hit.severity) {
    score = baseSeverity[hit.severity];
  } else if (hit.quantumSafe === false) {
    // Quantum-vulnerable asymmetric primitives dominate the score.
    score = hit.primitive === "signature" || hit.primitive === "key-agreement" ? 45 : 35;
  } else if (hit.quantumSafe === true) {
    score = 5;
  } else {
    score = 25; // unknown quantum posture — treat as moderate until classified
  }

  // Key length below the NIST SP 800-57 floor pushes the score up sharply.
  if (hit.classicalSecLevel !== undefined && hit.classicalSecLevel < SEC_FLOOR) {
    score += Math.round(((SEC_FLOOR - hit.classicalSecLevel) / SEC_FLOOR) * 30);
  }

  // Deprecated-family penalty for the classic broken primitives.
  const deprecated = /^(DES|3DES|RC4|MD5|SHA-1|Blowfish)/.test(hit.canonicalName);
  if (deprecated) score += 15;

  // Usage count — the more call sites depend on it, the bigger the blast radius.
  score += Math.min(10, Math.round(Math.log2(Math.max(1, opts.usageCount)) * 3));

  // Repository criticality multiplier.
  const critWeight: Record<Criticality["value"], number> = {
    CRITICAL: 10,
    HIGH: 6,
    MEDIUM: 2,
    LOW: 0,
  };
  score += critWeight[opts.criticality];

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function riskCategoryFromCrsf(crsf: number): "CRITICAL" | "HIGH" | "MODERATE" | "LOW" | "SAFE" {
  if (crsf >= 70) return "CRITICAL";
  if (crsf >= 45) return "HIGH";
  if (crsf >= 20) return "MODERATE";
  if (crsf >= 10) return "LOW";
  return "SAFE";
}

/**
 * CIS — conformance against NIST SP 800-131A Rev 3 transitions, 0-100.
 * Inverse-ish of CRSF but framed as "how compliant", with a written
 * explanation the drawer's CIS Explanation tab renders directly.
 */
export function computeCis(hit: NormalizedHit, crsfScore: number): { score: number; explanation: string } {
  const score = Math.max(0, Math.round(100 - crsfScore * 0.9));

  const lines: string[] = [];
  lines.push(
    `${hit.canonicalName} has a CRSF score of ${crsfScore}/100, classifying it as ${riskCategoryFromCrsf(crsfScore)} risk.`
  );
  if (hit.quantumSafe === false) {
    lines.push(
      "This algorithm is not quantum-safe. Under NIST SP 800-131A Rev 3 transition guidance, it should be migrated to a post-quantum alternative before the estimated CRQC arrival."
    );
  }
  if (hit.classicalSecLevel !== undefined && hit.classicalSecLevel < SEC_FLOOR) {
    lines.push(
      `Its classical security level (${hit.classicalSecLevel} bits) is below the NIST SP 800-57 floor of ${SEC_FLOOR} bits.`
    );
  }
  if (crsfScore >= 70) {
    lines.push(
      "Recommended action: immediately plan migration away from this algorithm."
    );
  } else if (hit.quantumSafe) {
    lines.push(
      "This algorithm meets current post-quantum security requirements and can be retained in the cryptographic inventory without immediate action."
    );
  }

  return { score, explanation: lines.join(" ") };
}

/** PQC safety 0-10 — per artefact. Renders as the coloured chip and the CBOM report donut. */
export function computePqcSafety(hit: NormalizedHit): number {
  if (hit.nistQuantumLevel !== undefined) {
    // NIST PQC category (0-5) maps roughly onto the 0-10 chip scale.
    return Math.min(10, hit.nistQuantumLevel * 2);
  }
  if (hit.quantumSafe === true) return 8;
  if (hit.quantumSafe === false) return 2;
  return 5;
}

// Organisation-wide quantum-readiness roll-up (the dashboard gauge) is
// computed directly in src/server/db/dashboard.ts via a SQL-side average —
// scoped to graded primitives — rather than re-implemented here in JS.

// ─── Mosca's inequality ─────────────────────────────────────────────────────
// X (data lifetime) + Y (migration time) > Z (time to CRQC) => act now

export interface MoscaInput {
  dataLifetimeYears: number; // X
  quantumVulnerableCount: number;
  totalAssetCount: number;
  crqcArrivalYear?: number; // default 2033
}

export interface MoscaResult {
  x: number;
  y: number;
  z: number;
  verdict: "ACT_NOW" | "PLAN" | "SAFE";
}

const DEFAULT_CRQC_YEAR = 2033;
const CURRENT_YEAR = new Date().getFullYear();

/**
 * Y — estimated migration time from quantum-vulnerable artefact count,
 * weighted by migration complexity. More vulnerable surface area takes
 * longer to remediate; the curve is deliberately sub-linear (log) so a
 * thousand-artefact monorepo doesn't dwarf every other input.
 */
export function estimateMigrationYears(quantumVulnerableCount: number): number {
  if (quantumVulnerableCount === 0) return 0;
  return Math.min(8, Math.max(1, Math.round(Math.log2(quantumVulnerableCount + 1) * 1.3)));
}

export function computeMosca(input: MoscaInput): MoscaResult {
  const z = (input.crqcArrivalYear ?? DEFAULT_CRQC_YEAR) - CURRENT_YEAR;
  const x = input.dataLifetimeYears;
  const y = estimateMigrationYears(input.quantumVulnerableCount);

  const sum = x + y;
  let verdict: MoscaResult["verdict"];
  if (input.quantumVulnerableCount === 0) {
    verdict = "SAFE";
  } else if (sum > z) {
    verdict = "ACT_NOW";
  } else if (sum > z - 3) {
    verdict = "PLAN";
  } else {
    verdict = "SAFE";
  }

  return { x, y, z, verdict };
}
