/**
 * Finding derivation — Phase 5, Step 7.
 *
 * PURE LOGIC ONLY: no Prisma import, no I/O, no Math.random(), no
 * timestamps. Given one CryptoAsset's normalised fields plus the owning
 * repository's criticality, returns the FindingCandidate rows that asset
 * should produce this scan. Persistence (create/update/resolve) is a
 * separate concern — see src/server/findings/persist.ts.
 *
 * Source of truth for algorithm transition status is
 * src/server/scoring/deprecated-algorithms.ts (NIST SP 800-131A Rev.3) —
 * this module never re-implements or duplicates that table, it only reads
 * from it, exactly like crsf.ts and cis.ts already do.
 */
import {
  lookupTransitionStatus,
  getCurveBitSize,
  RSA_DSA_ALGORITHMS,
  RSA_DSA_DISALLOWED_BELOW_BITS,
  EC_DISALLOWED_BELOW_BITS,
  type DeprecatedAlgorithmEntry,
} from "@/server/scoring/deprecated-algorithms";
import { lookupProtocolTransitionStatus } from "@/server/scoring/protocol-transitions";

export type Severity = "CRITICAL" | "HIGH" | "MODERATE" | "LOW" | "COMPLIANT";
export type RepositoryCriticality = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type FindingAssetKind = "ALGORITHM" | "CERTIFICATE" | "KEY" | "PROTOCOL" | "LIBRARY" | "SECRET";

/**
 * Everything derivation needs about one CryptoAsset. Mirrors the relevant
 * subset of the Prisma CryptoAsset columns (prisma/schema.prisma) — the
 * caller (src/server/scoring/engine.ts) maps a fetched row onto this shape.
 */
export interface FindingSourceAsset {
  id: string;
  kind: FindingAssetKind;
  name: string;
  algorithm: string | null;
  keyLengthBits: number | null;
  curve: string | null;
  quantumSafe: boolean | null;
  filePath: string;
  lineNumber: number | null;
}

/** Enough information for the persistence layer to create/update a Finding row without re-deriving anything. */
export interface FindingCandidate {
  code: string;
  severity: Severity;
  title: string;
  detail: string;
  remediation: string | null;
  cweId: string | null;
  nistRef: string | null;
  affectedComponent: string | null;
  filePath: string | null;
  lineNumber: number | null;
  /** The CryptoAsset that triggered this candidate — see persist.ts for why this is the stable identity key. */
  cryptoAssetId: string;
}

const NIST_TRANSITION_REF = "NIST SP 800-131A Rev.3";
const NIST_KEYLENGTH_REF = "NIST SP 800-57 Part 1 Rev.5";

const CWE_BROKEN_ALGORITHM = "CWE-327"; // Use of a Broken or Risky Cryptographic Algorithm
const CWE_INADEQUATE_KEY_STRENGTH = "CWE-326"; // Inadequate Encryption Strength
const CWE_HARDCODED_CREDENTIALS = "CWE-798"; // Use of Hard-coded Credentials
const NIST_PROTOCOL_REF = "NIST SP 800-52 Rev.2";

const GENERIC_REMEDIATION = "Migrate to a currently approved cryptographic algorithm.";

// ─── Replacement map (§ REPLACEMENT MAP) ───────────────────────────────────

/**
 * Direct, explicit replacements for algorithms this project's scoring table
 * already treats as disallowed/legacy. Deliberately small and literal — if
 * an algorithm isn't in here (or in the RSA/EC key-length branches below),
 * callers fall back to a generic remediation rather than guessing.
 */
const REPLACEMENT_MAP: Record<string, string> = {
  DES: "AES-256-GCM",
  "3DES": "AES-256-GCM",
  RC4: "AES-256-GCM",
  MD5: "SHA-256",
  "SHA-1": "SHA-256",
  DSA: "ECDSA (P-256) or RSA-3072",
};

/** Builds a remediation string for a disallowed/legacy/weak-key finding. Never claims quantum-safety for a merely "newer" algorithm. */
function buildRemediation(algorithm: string | null, keyLengthBits: number | null, curve: string | null): string {
  if (curve != null) {
    return "Migrate to a NIST P-256 (secp256r1) curve or larger, or to X25519 for key exchange.";
  }

  const algo = (algorithm ?? "").toUpperCase();

  if (RSA_DSA_ALGORITHMS.has(algo.toLowerCase()) || algo === "RSA" || algo === "DSA") {
    if (keyLengthBits != null && keyLengthBits < RSA_DSA_DISALLOWED_BELOW_BITS) {
      return "Migrate to RSA-3072 or larger (or an equivalent-strength modern algorithm such as ECDSA P-256 or Ed25519).";
    }
  }

  const direct = REPLACEMENT_MAP[algo];
  if (direct) {
    return `Migrate to ${direct}.`;
  }

  return GENERIC_REMEDIATION;
}

// ─── Disallowed / legacy algorithm findings ────────────────────────────────

function disallowedFinding(
  asset: FindingSourceAsset,
  transition: DeprecatedAlgorithmEntry,
  repositoryCriticality: RepositoryCriticality
): FindingCandidate {
  const severity: Severity =
    repositoryCriticality === "HIGH" || repositoryCriticality === "CRITICAL" ? "CRITICAL" : "HIGH";

  return {
    code: "CRYPTO-DISALLOWED",
    severity,
    title: `Disallowed algorithm: ${transition.algorithm}`,
    detail: transition.explanation,
    remediation: buildRemediation(asset.algorithm, asset.keyLengthBits, asset.curve),
    cweId: CWE_BROKEN_ALGORITHM,
    nistRef: NIST_TRANSITION_REF,
    affectedComponent: asset.name,
    filePath: asset.filePath,
    lineNumber: asset.lineNumber,
    cryptoAssetId: asset.id,
  };
}

function legacyFinding(asset: FindingSourceAsset, transition: DeprecatedAlgorithmEntry): FindingCandidate {
  return {
    code: "CRYPTO-LEGACY",
    severity: "MODERATE",
    title: `Legacy algorithm: ${transition.algorithm}`,
    detail: transition.explanation,
    remediation: buildRemediation(asset.algorithm, asset.keyLengthBits, asset.curve),
    cweId: CWE_BROKEN_ALGORITHM,
    nistRef: NIST_TRANSITION_REF,
    affectedComponent: asset.name,
    filePath: asset.filePath,
    lineNumber: asset.lineNumber,
    cryptoAssetId: asset.id,
  };
}

// ─── Weak key length (§ WEAK KEY LENGTH) ───────────────────────────────────

/**
 * CERTIFICATE/KEY assets only. Reuses the exact RSA/EC floors already
 * defined in deprecated-algorithms.ts (the same constants crsf.ts's CRSF
 * scoring reads) rather than inventing a second key-length policy. Can
 * co-occur with CRYPTO-DISALLOWED for the same asset (e.g. RSA-1024 is both
 * disallowed outright *and* below the key-length floor) — that's two
 * distinct, independently-explainable risk axes (CWE-327 vs CWE-326), not a
 * duplicate.
 */
function weakKeyLengthFinding(asset: FindingSourceAsset): FindingCandidate | null {
  if (asset.kind !== "CERTIFICATE" && asset.kind !== "KEY") return null;
  if (asset.quantumSafe !== false) return null;

  let floorBits: number | null = null;
  let actualBits: number | null = null;
  let label: string;

  if (asset.curve != null) {
    const curveBits = getCurveBitSize(asset.curve);
    if (curveBits == null) return null;
    floorBits = EC_DISALLOWED_BELOW_BITS;
    actualBits = curveBits;
    label = `EC curve ${asset.curve} (${curveBits}-bit)`;
  } else {
    const algo = (asset.algorithm ?? "").toLowerCase();
    if (!RSA_DSA_ALGORITHMS.has(algo) && algo !== "rsa" && algo !== "dsa") return null;
    if (asset.keyLengthBits == null) return null;
    floorBits = RSA_DSA_DISALLOWED_BELOW_BITS;
    actualBits = asset.keyLengthBits;
    label = `${asset.algorithm}-${asset.keyLengthBits}`;
  }

  if (actualBits >= floorBits) return null;

  return {
    code: "CRYPTO-WEAK-KEYLENGTH",
    severity: "HIGH",
    title: `Weak key length: ${label}`,
    detail: `${label} is below the ${floorBits}-bit floor required for this algorithm class and is not quantum-safe.`,
    remediation: buildRemediation(asset.algorithm, asset.keyLengthBits, asset.curve),
    cweId: CWE_INADEQUATE_KEY_STRENGTH,
    nistRef: NIST_KEYLENGTH_REF,
    affectedComponent: asset.name,
    filePath: asset.filePath,
    lineNumber: asset.lineNumber,
    cryptoAssetId: asset.id,
  };
}

// ─── Certificate expiry ─────────────────────────────────────────────────────
//
// NOT IMPLEMENTED. CryptoAsset (prisma/schema.prisma) has no notAfter/
// notBefore column — the certificate/key detector's NormalizedCryptoUsage
// carries notAfter (see src/server/detectors/types.ts), but
// certkey-detector.ts's upsertCertKeyAsset() deliberately never persists it
// because no column exists (documented there and in src/server/detectors/
// types.ts). Per this step's instructions: do not modify the Prisma schema
// to add the field, do not invent it — skip CERT-EXPIRED/CERT-EXPIRING-SOON
// entirely. See the final summary's "CERTIFICATE EXPIRY GAP" section.

// ─── Protocol/config findings (§ PROTOCOL FINDINGS, Phase 5 Step 8) ────────

/**
 * PROTOCOL-kind assets (nginx ssl_protocols/ssl_ciphers, sshd_config
 * Ciphers/MACs/KexAlgorithms, Terraform TLS version config) never go
 * through the ALGORITHM/CERTIFICATE/KEY path below — a protocol-version or
 * cipher-suite *name* is not the same kind of thing as an algorithm choice,
 * per the Step 8 spec's explicit warning against blindly mapping one onto
 * the other. Status is resolved by checking the existing
 * deprecated-algorithms.ts table FIRST (reuse: an SSH cipher/MAC that
 * reduces to a known-weak algorithm — 3des-cbc, hmac-md5, hmac-sha1,
 * arcfour — is classified exactly like any other 3DES/MD5/SHA-1/RC4 use),
 * then falling back to the small, narrowly-scoped protocol-transitions.ts
 * table for identifiers only that table has an opinion on (TLS versions,
 * a handful of SSH-specific names).
 */
function protocolFinding(
  asset: FindingSourceAsset,
  transition: DeprecatedAlgorithmEntry,
  repositoryCriticality: RepositoryCriticality
): FindingCandidate {
  // Reuses the exact same repository-criticality severity rule as
  // disallowedFinding()/legacyFinding() above — no new severity framework.
  const severity: Severity =
    transition.status === "disallowed"
      ? repositoryCriticality === "HIGH" || repositoryCriticality === "CRITICAL"
        ? "CRITICAL"
        : "HIGH"
      : "MODERATE";

  return {
    code: "WEAK-PROTOCOL-CONFIG",
    severity,
    title: `Weak protocol configuration: ${transition.algorithm}`,
    detail: transition.explanation,
    remediation: buildRemediation(asset.algorithm, asset.keyLengthBits, asset.curve),
    cweId: CWE_BROKEN_ALGORITHM,
    nistRef: NIST_PROTOCOL_REF,
    affectedComponent: asset.name,
    filePath: asset.filePath,
    lineNumber: asset.lineNumber,
    cryptoAssetId: asset.id,
  };
}

function deriveProtocolFindings(asset: FindingSourceAsset, repositoryCriticality: RepositoryCriticality): FindingCandidate[] {
  const transition =
    lookupTransitionStatus({ algorithm: asset.algorithm, keyLengthBits: null, curve: null }) ??
    lookupProtocolTransitionStatus(asset.algorithm);

  if (transition?.status === "disallowed" || transition?.status === "legacy") {
    return [protocolFinding(asset, transition, repositoryCriticality)];
  }
  // acceptable/recommended/unknown -> no finding, per spec: an asset merely
  // existing is never itself a vulnerability.
  return [];
}

// ─── Secret findings (§ PART C, Phase 5 Step 8) ────────────────────────────

/**
 * SECRET-kind assets only ever reach this point after secrets-scan.ts's
 * strict length/entropy/context/exclusion gates already passed — so every
 * SECRET asset unconditionally produces a finding. CRITICAL regardless of
 * repository criticality, per spec (a hardcoded secret is a maximal-impact
 * finding independent of how critical the repository happens to be rated).
 * `asset.name` here is already the safe `SECRET_xxxx_<hash>` representation
 * built in secrets-scan.ts — never the raw value.
 */
function hardcodedSecretFinding(asset: FindingSourceAsset): FindingCandidate {
  return {
    code: "HARDCODED-SECRET",
    severity: "CRITICAL",
    title: `Hardcoded secret: ${asset.name}`,
    detail:
      "A high-entropy literal was found hardcoded in a crypto-adjacent context. Hardcoded secrets remain recoverable from source-control history even after later removal.",
    remediation: "Rotate this secret immediately and move it to a secrets manager / environment variable.",
    cweId: CWE_HARDCODED_CREDENTIALS,
    nistRef: null,
    affectedComponent: asset.name,
    filePath: asset.filePath,
    lineNumber: asset.lineNumber,
    cryptoAssetId: asset.id,
  };
}

// ─── Public entry point ─────────────────────────────────────────────────────

export function deriveFindingsForAsset(
  asset: FindingSourceAsset,
  repositoryCriticality: RepositoryCriticality
): FindingCandidate[] {
  // PROTOCOL and SECRET assets each have their own, entirely separate
  // derivation path (see above) — they never fall through to the
  // ALGORITHM/CERTIFICATE/KEY logic below, and that logic is otherwise
  // completely unchanged from Phase 5, Step 7.
  if (asset.kind === "PROTOCOL") {
    return deriveProtocolFindings(asset, repositoryCriticality);
  }
  if (asset.kind === "SECRET") {
    return [hardcodedSecretFinding(asset)];
  }

  const candidates: FindingCandidate[] = [];

  const transition = lookupTransitionStatus({
    algorithm: asset.algorithm,
    keyLengthBits: asset.keyLengthBits,
    curve: asset.curve,
  });

  if (transition?.status === "disallowed") {
    candidates.push(disallowedFinding(asset, transition, repositoryCriticality));
  } else if (transition?.status === "legacy") {
    candidates.push(legacyFinding(asset, transition));
  }

  const weakKey = weakKeyLengthFinding(asset);
  if (weakKey) candidates.push(weakKey);

  return candidates;
}
