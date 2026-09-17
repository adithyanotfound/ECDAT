/**
 * Shared detector rule types — Phase 4, Step 2.
 *
 * These types are intentionally decoupled from Prisma so that rule packs and
 * the matching engine can be unit-tested without a database. The persistence
 * layer (in each detector's runner) maps `NormalizedCryptoUsage` onto the
 * `CryptoAsset` columns defined in prisma/schema.prisma.
 *
 * The shape mirrors IMPLEMENTATION_PLAN.md "4a Detector families" (rule
 * fields) and "4b Normalisation" (canonical vocabulary), and is written to
 * be reusable by future rule packs (manifests, certificates, protocols, …),
 * not just the JS/TS call-site detector implemented in this step.
 */

/** Source languages a rule can apply to. Extend as future packs need them. */
export type RuleLanguage = "javascript" | "typescript";

/**
 * The CryptoAsset.kind values a rule can produce. For this step every JS/TS
 * call-site rule produces "ALGORITHM" — the union stays open for future
 * detector families (certificates, keys, protocols, secrets, libraries).
 */
export type CryptoAssetKind = "ALGORITHM" | "CERTIFICATE" | "KEY" | "PROTOCOL" | "LIBRARY" | "SECRET";

/** Informational severity carried on the rule for provenance/future use. */
export type RuleSeverity = "CRITICAL" | "HIGH" | "MODERATE" | "LOW" | "INFO";

/**
 * Canonical, normalised crypto usage extracted from a single match. Maps
 * directly onto CryptoAsset columns (excluding identity/location fields,
 * which the matching engine supplies from context). Fields the source
 * doesn't statically reveal must be left `null`/`undefined` — never guessed.
 */
export interface NormalizedCryptoUsage {
  kind: CryptoAssetKind;
  /** Canonical display name, e.g. "SHA-256", "AES-256-GCM", "RSA". */
  name: string;
  primitive?: string | null;
  algorithm?: string | null;
  keyLengthBits?: number | null;
  mode?: string | null;
  padding?: string | null;
  curve?: string | null;
  nistQuantumLevel?: number | null;
  quantumSafe?: boolean | null;
  executionEnvironment?: string | null;
  classicalSecLevel?: number | null;
  /**
   * Extra stable, deterministic text folded into the fingerprint when two
   * distinct usages would otherwise collide (e.g. a captured curve name
   * already covered by `curve` normally makes this unnecessary).
   */
  fingerprintExtra?: string;

  /**
   * X.509 certificate metadata (Phase 4, Step 4) — only populated for
   * `kind: "CERTIFICATE"`. Carried through the pure scanner result for
   * future finding generation (e.g. certificate-expiry findings); none of
   * these are persisted to a CryptoAsset column today, since none exists
   * for them — see certkey-detector.ts.
   */
  notBefore?: string | null;
  notAfter?: string | null;
  issuer?: string | null;
  subject?: string | null;
  serialNumber?: string | null;
  signatureAlgorithm?: string | null;
}

/** Context supplied to a rule's `extract` for a single regex match. */
export interface RuleMatchContext {
  /** Path relative to the repository root (never an absolute temp path). */
  relativeFilePath: string;
  /** 1-based source line number. */
  lineNumber: number;
  /** The full text of the matched line. */
  line: string;
}

/**
 * Produces normalised crypto usage for a match, or `null` when the match is
 * syntactically recognised but cannot be statically resolved with
 * confidence (e.g. a dynamic, non-literal algorithm argument) — such matches
 * are dropped rather than persisted with invented data.
 */
export type RuleExtractor = (match: RegExpExecArray, context: RuleMatchContext) => NormalizedCryptoUsage | null;

/**
 * A single, structured detection rule. Rule packs are arrays of these —
 * never scattered inline regexes inside a detector/scanner.
 */
export interface CryptoRule {
  /** Stable, globally unique id. Stored verbatim as CryptoAsset.ruleId. */
  id: string;
  /** The rule pack this rule belongs to, e.g. "js-crypto". */
  pack: string;
  languages: readonly RuleLanguage[];
  /** Simple `**\/*.ext` glob patterns this rule applies to. */
  filePatterns: readonly string[];
  /** Must include the global ("g") regex flag — enforced at rule-load time. */
  pattern: RegExp;
  severity: RuleSeverity;
  cweId?: string;
  nistRef?: string;
  extract: RuleExtractor;
}

/** Throws if any rule in a pack is missing the "g" flag its matcher requires. */
export function assertValidRulePack(rules: readonly CryptoRule[]): void {
  for (const rule of rules) {
    if (!rule.pattern.flags.includes("g")) {
      throw new Error(`Rule "${rule.id}" pattern must use the global ("g") flag`);
    }
  }
}
