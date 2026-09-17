/**
 * NIST SP 800-131A Rev.3 algorithm-transition table — Phase 4, Step 5.
 *
 * Centralises every deprecated/weak-algorithm judgement the scoring engine
 * makes, so CRSF (crsf.ts) and CIS conformance (cis.ts) both consult ONE
 * table instead of scattering `if (algorithm === "MD5")`-style conditions
 * through scoring code.
 *
 * `lookupTransitionStatus` takes key length/curve into account because
 * transition status genuinely depends on them (RSA-1024 is disallowed,
 * RSA-2048 is acceptable; a sub-224-bit EC curve is disallowed, P-256 is
 * recommended) — a flat algorithm-name table alone can't express that.
 */

export type TransitionStatus = "disallowed" | "legacy" | "acceptable" | "recommended";

export interface DeprecatedAlgorithmEntry {
  /** Canonical algorithm/curve label this entry describes. */
  algorithm: string;
  status: TransitionStatus;
  /** Short, plain-English explanation suitable for RiskAssessment.cisExplanation. */
  explanation: string;
}

export interface TransitionLookupInput {
  algorithm: string | null;
  keyLengthBits: number | null;
  curve: string | null;
}

// ─── Flat entries: algorithms whose status never depends on key length ────

const FLAT_TABLE: Record<string, DeprecatedAlgorithmEntry> = {
  des: {
    algorithm: "DES",
    status: "disallowed",
    explanation: "DES uses a 56-bit key, trivially brute-forced; disallowed by NIST SP 800-131A Rev.3.",
  },
  "3des": {
    algorithm: "3DES",
    status: "disallowed",
    explanation:
      "3DES provides only ~112-bit security and is subject to Sweet32 birthday-bound attacks; NIST SP 800-131A Rev.3 disallows it.",
  },
  rc4: {
    algorithm: "RC4",
    status: "disallowed",
    explanation: "RC4 has multiple practical statistical biases and is disallowed by NIST SP 800-131A.",
  },
  md5: {
    algorithm: "MD5",
    status: "disallowed",
    explanation: "MD5 has practical collision attacks and is disallowed for any security use.",
  },
  "sha-1": {
    algorithm: "SHA-1",
    status: "disallowed",
    explanation: "SHA-1 has practical collision attacks (SHAttered) and is disallowed for digital signatures.",
  },
  dsa: {
    algorithm: "DSA",
    status: "legacy",
    explanation: "DSA is legacy-only under NIST SP 800-131A Rev.3; migrate to RSA or ECDSA.",
  },
  "ed25519": {
    algorithm: "Ed25519",
    status: "recommended",
    explanation: "Ed25519 is a modern, recommended signature scheme with strong classical security margins.",
  },
  "ed448": {
    algorithm: "Ed448",
    status: "recommended",
    explanation: "Ed448 is a modern, recommended signature scheme with strong classical security margins.",
  },
  "x25519": {
    algorithm: "X25519",
    status: "recommended",
    explanation: "X25519 is a modern, recommended key-exchange curve with strong classical security margins.",
  },
  "x448": {
    algorithm: "X448",
    status: "recommended",
    explanation: "X448 is a modern, recommended key-exchange curve with strong classical security margins.",
  },
  chacha20: {
    algorithm: "ChaCha20",
    status: "recommended",
    explanation: "ChaCha20 is a modern 256-bit stream cipher with no known practical weaknesses.",
  },
  "chacha20-poly1305": {
    algorithm: "ChaCha20-Poly1305",
    status: "recommended",
    explanation: "ChaCha20-Poly1305 is a modern, widely-recommended AEAD construction.",
  },
};

// ─── RSA / DSA: status depends on modulus length ───────────────────────────

const RSA_DSA_ALGORITHMS = new Set(["rsa", "rsa-pss", "rsa-oaep"]);
export const RSA_DSA_DISALLOWED_BELOW_BITS = 2048;
export const RSA_DSA_RECOMMENDED_AT_OR_ABOVE_BITS = 3072;

function rsaEntry(keyLengthBits: number | null): DeprecatedAlgorithmEntry {
  if (keyLengthBits == null) {
    return {
      algorithm: "RSA",
      status: "acceptable",
      explanation: "RSA modulus length unknown from the source; unable to confirm it meets the 2048-bit floor.",
    };
  }
  if (keyLengthBits < RSA_DSA_DISALLOWED_BELOW_BITS) {
    return {
      algorithm: "RSA",
      status: "disallowed",
      explanation: `RSA-${keyLengthBits} is below the NIST SP 800-131A 2048-bit floor and is disallowed.`,
    };
  }
  if (keyLengthBits < RSA_DSA_RECOMMENDED_AT_OR_ABOVE_BITS) {
    return {
      algorithm: "RSA",
      status: "acceptable",
      explanation: `RSA-${keyLengthBits} meets the NIST SP 800-131A 2048-bit floor and is currently acceptable.`,
    };
  }
  return {
    algorithm: "RSA",
    status: "recommended",
    explanation: `RSA-${keyLengthBits} meets or exceeds the 3072-bit strength NIST recommends for long-term use.`,
  };
}

// ─── Elliptic curves: status depends on curve size ─────────────────────────

/** Field sizes for curves this project's normalizers can produce (see detectors/normalize.ts CURVE_TABLE). */
export const CURVE_BIT_SIZES: Record<string, number> = {
  secp256r1: 256,
  secp384r1: 384,
  secp521r1: 521,
  secp256k1: 256,
};

export const EC_DISALLOWED_BELOW_BITS = 224;
export const EC_RECOMMENDED_AT_OR_ABOVE_BITS = 256;

/** Returns the curve's field size in bits, or null if the curve isn't in the known table. */
export function getCurveBitSize(curve: string): number | null {
  return CURVE_BIT_SIZES[curve.trim().toLowerCase()] ?? null;
}

function ecEntry(curve: string): DeprecatedAlgorithmEntry {
  const bits = getCurveBitSize(curve);
  if (bits == null) {
    return {
      algorithm: `EC (${curve})`,
      status: "acceptable",
      explanation: `Curve "${curve}" is not in the known curve-size table; unable to confirm its NIST transition status.`,
    };
  }
  if (bits < EC_DISALLOWED_BELOW_BITS) {
    return {
      algorithm: `EC (${curve})`,
      status: "disallowed",
      explanation: `${curve} provides only ${bits}-bit field size, below the 224-bit NIST floor; disallowed.`,
    };
  }
  if (bits < EC_RECOMMENDED_AT_OR_ABOVE_BITS) {
    return {
      algorithm: `EC (${curve})`,
      status: "legacy",
      explanation: `${curve} (${bits}-bit) meets the 224-bit floor but is below the 256-bit curves NIST now recommends.`,
    };
  }
  return {
    algorithm: `EC (${curve})`,
    status: "recommended",
    explanation: `${curve} (${bits}-bit) meets current NIST recommendations for elliptic-curve strength.`,
  };
}

// ─── Public lookup ──────────────────────────────────────────────────────────

/**
 * Resolves the NIST SP 800-131A Rev.3 transition status for a detected
 * asset. Returns null when the algorithm is genuinely not in this table —
 * callers must treat that as "unknown", never as "safe".
 */
export function lookupTransitionStatus(input: TransitionLookupInput): DeprecatedAlgorithmEntry | null {
  const algo = input.algorithm?.trim().toLowerCase() ?? null;

  if (input.curve) {
    return ecEntry(input.curve);
  }

  if (algo && RSA_DSA_ALGORITHMS.has(algo)) {
    return rsaEntry(input.keyLengthBits);
  }

  if (algo && FLAT_TABLE[algo]) {
    return FLAT_TABLE[algo];
  }

  return null;
}
