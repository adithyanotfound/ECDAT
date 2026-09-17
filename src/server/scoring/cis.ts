/**
 * CIS conformance scoring — Phase 4, Step 5.
 *
 * "CIS" here means conformance against the NIST SP 800-131A Rev.3
 * algorithm-transition guidance (per IMPLEMENTATION_PLAN.md's own naming),
 * not the separate CIS Benchmarks. Score bands map directly from the
 * shared transition-status table in deprecated-algorithms.ts so this file
 * contains no scattered per-algorithm conditions of its own.
 */
import { lookupTransitionStatus, type TransitionStatus } from "./deprecated-algorithms";
import type { ScoringInput } from "./types";

const CIS_SCORE_BY_STATUS: Record<TransitionStatus, number> = {
  disallowed: 10,
  legacy: 40,
  acceptable: 75,
  recommended: 100,
};

/** Neutral default for an algorithm this project's transition table doesn't cover. */
const CIS_SCORE_UNKNOWN_DEFAULT = 50;

export interface CisConformanceResult {
  cisScore: number;
  cisExplanation: string;
}

export function computeCisConformance(input: ScoringInput): CisConformanceResult {
  const transition = lookupTransitionStatus({
    algorithm: input.algorithm,
    keyLengthBits: input.keyLengthBits,
    curve: input.curve,
  });

  if (!transition) {
    const label = input.algorithm ?? input.curve ?? "This algorithm";
    return {
      cisScore: CIS_SCORE_UNKNOWN_DEFAULT,
      // Unknown must never be reported as safe — a neutral score plus an
      // explicit "we don't know" explanation, never an implied "compliant".
      cisExplanation: `${label} is not present in the NIST SP 800-131A Rev.3 transition table; conformance cannot be confirmed.`,
    };
  }

  return {
    cisScore: CIS_SCORE_BY_STATUS[transition.status],
    cisExplanation: transition.explanation,
  };
}
