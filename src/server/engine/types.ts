/**
 * Core types for the discovery engine.
 *
 * A Rule is data, not code-shaped-as-data: { id, pack, languages, filePatterns,
 * match, extract, severity, cweId, nistRef } per IMPLEMENTATION_PLAN.md §4a.
 * Every DetectionHit names the rule that produced it, so a Finding is always
 * explainable back to a specific detector.
 */

export type CryptoKind =
  | "ALGORITHM"
  | "CERTIFICATE"
  | "KEY"
  | "PROTOCOL"
  | "LIBRARY"
  | "SECRET";

export type RulePack =
  | "callsites"
  | "manifests"
  | "certificates"
  | "keys"
  | "protocols"
  | "secrets";

export type SeverityLevel = "CRITICAL" | "HIGH" | "MODERATE" | "LOW" | "COMPLIANT";

/** A raw hit before normalisation — what a detector actually emits. */
export interface RawHit {
  ruleId: string;
  pack: RulePack;
  kind: CryptoKind;
  /** Name as observed in source, e.g. "DES/ECB/PKCS5Padding" or "hashlib.md5" */
  rawName: string;
  primitive?: string;
  algorithm?: string;
  keyLengthBits?: number;
  mode?: string;
  padding?: string;
  curve?: string;
  quantumSafe?: boolean;
  nistQuantumLevel?: number;
  executionEnvironment?: string;
  classicalSecLevel?: number;
  filePath: string;
  lineNumber?: number;
  /** Raw matched text/snippet, used for the finding detail and CBOM evidence. */
  evidence: string;
  /** Confidence 0-1 — used to gate secrets and keep the inventory precise. */
  confidence: number;
  severity?: SeverityLevel;
  cweId?: string;
  nistRef?: string;
  /** For manifests: resolved dependency version, if any. */
  version?: string;
}

/** A normalised, CBOM-vocabulary hit — one row in CryptoAsset. */
export interface NormalizedHit extends RawHit {
  /** Canonical algorithm name, e.g. "3DES", "RSA-2048", "SHA-256". */
  canonicalName: string;
  fingerprint: string;
}

export interface Rule {
  id: string;
  pack: RulePack;
  languages: string[];
  /** fast-glob patterns relative to repo root that this rule applies to. */
  filePatterns: string[];
  /** Returns zero or more raw hits found in this file's content. filePath is filled in by the orchestrator. */
  match: (content: string, filePath: string) => Omit<RawHit, "ruleId" | "pack">[];
  cweId?: string;
  nistRef?: string;
}

export interface ScanProfileConfig {
  includeGlobs: string[];
  excludeGlobs: string[];
  maxFileSizeKb: number;
  rulePackIds: string[];
}

export const DEFAULT_PROFILE: ScanProfileConfig = {
  includeGlobs: ["**/*"],
  excludeGlobs: [
    "**/node_modules/**",
    "**/.git/**",
    "**/dist/**",
    "**/build/**",
    "**/target/**",
    "**/vendor/**",
    "**/.next/**",
    "**/__pycache__/**",
    "**/*.min.js",
  ],
  maxFileSizeKb: 1024,
  rulePackIds: ["callsites", "manifests", "certificates", "keys", "protocols", "secrets"],
};

export interface EngineResult {
  hits: NormalizedHit[];
  filesScanned: number;
  filesSkipped: number;
  durationMs: number;
  truncated: boolean;
}
