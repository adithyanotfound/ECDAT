/**
 * One place for colour coding. A "tone" is a family of three colours from
 * globals.css: a fill for marks (dots, bars), an ink for text and a tint for
 * backgrounds. Pages ask for a tone by meaning, never by hex value.
 */
export type Tone = "critical" | "high" | "moderate" | "low" | "safe" | "neutral" | "gold";

export const TONE: Record<Tone, { fill: string; ink: string; tint: string }> = {
  critical: { fill: "var(--color-critical)", ink: "var(--color-critical-ink)", tint: "var(--color-critical-tint)" },
  high: { fill: "var(--color-high)", ink: "var(--color-high-ink)", tint: "var(--color-high-tint)" },
  moderate: { fill: "var(--color-moderate)", ink: "var(--color-moderate-ink)", tint: "var(--color-moderate-tint)" },
  low: { fill: "var(--color-low)", ink: "var(--color-low-ink)", tint: "var(--color-low-tint)" },
  safe: { fill: "var(--color-safe)", ink: "var(--color-safe-ink)", tint: "var(--color-safe-tint)" },
  neutral: { fill: "var(--color-neutral)", ink: "var(--color-neutral-ink)", tint: "var(--color-neutral-tint)" },
  gold: { fill: "var(--color-gold)", ink: "var(--color-gold-ink)", tint: "var(--color-gold-soft)" },
};

export type SeverityLabel = "Critical" | "High" | "Moderate" | "Low" | "Compliant";

export const SEVERITY_TONE: Record<SeverityLabel, Tone> = {
  Critical: "critical",
  High: "high",
  Moderate: "moderate",
  Low: "low",
  Compliant: "safe",
};

/**
 * Risk score (0–100) → band. Same cut-offs as riskCategoryFromCrsf in
 * src/server/engine/scoring.ts, so the colour always matches the stored category.
 */
export function riskBand(score: number): { label: SeverityLabel; tone: Tone; advice: string } {
  if (score >= 70) return { label: "Critical", tone: "critical", advice: "Fix this first." };
  if (score >= 45) return { label: "High", tone: "high", advice: "Plan a fix soon." };
  if (score >= 20) return { label: "Moderate", tone: "moderate", advice: "Schedule it with other upgrades." };
  if (score >= 10) return { label: "Low", tone: "low", advice: "Worth knowing about; no rush." };
  return { label: "Compliant", tone: "safe", advice: "No action needed." };
}

/** Post-quantum safety (0–10) → tone. */
export function pqcTone(score: number, max = 10): Tone {
  const pct = score / max;
  return pct >= 0.7 ? "safe" : pct >= 0.4 ? "moderate" : "critical";
}

export type MoscaVerdict = "ACT_NOW" | "PLAN" | "SAFE";

export const MOSCA: Record<MoscaVerdict, { label: string; tone: Tone; plain: string }> = {
  ACT_NOW: {
    label: "Act now",
    tone: "critical",
    plain: "The data must stay secret longer than we have before quantum computers arrive. Start moving now.",
  },
  PLAN: {
    label: "Plan migration",
    tone: "moderate",
    plain: "There's still time, but the move should be on the roadmap.",
  },
  SAFE: { label: "Safe today", tone: "safe", plain: "Already quantum-safe, or not at risk within the timeline." },
};

export const EFFORT: Record<"HIGH" | "MEDIUM" | "LOW", { label: string; tone: Tone; plain: string }> = {
  HIGH: { label: "High effort", tone: "critical", plain: "Part of the system has to be redesigned." },
  MEDIUM: { label: "Medium effort", tone: "moderate", plain: "A normal migration: code changes and testing." },
  LOW: { label: "Low effort", tone: "safe", plain: "A setting change or a drop-in library swap." },
};

export type ScanStatusLabel = "Completed" | "Running" | "Failed" | "Queued";

export const SCAN_STATUS: Record<ScanStatusLabel, { label: string; tone: Tone }> = {
  Completed: { label: "Completed", tone: "safe" },
  Running: { label: "Running", tone: "low" },
  Failed: { label: "Failed", tone: "critical" },
  Queued: { label: "Waiting", tone: "neutral" },
};

/** Accepts either the UI label ("Completed") or the database enum ("COMPLETED"). */
export function toScanStatus(s: string | null | undefined): ScanStatusLabel | null {
  if (!s) return null;
  const v = s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  return v === "Completed" || v === "Running" || v === "Failed" || v === "Queued" ? v : null;
}
