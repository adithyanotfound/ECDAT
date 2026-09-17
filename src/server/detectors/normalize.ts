/**
 * Canonical crypto-algorithm normalisation — Phase 4, Step 2.
 *
 * Maps raw, source-level algorithm tokens (OpenSSL cipher names, Node digest
 * names, WebCrypto algorithm names, key-generation types) onto the canonical
 * vocabulary from IMPLEMENTATION_PLAN.md "4b Normalisation". Centralised here
 * so the same raw token always normalises identically regardless of which
 * rule matched it — the plan warns that normalising inside each rule instead
 * produces "AES256", "aes-256-gcm" and "AES_256_GCM" as three separate
 * assets.
 *
 * `quantumSafe` follows the same classical-vs-symmetric split the Phase 3
 * placeholder data already used (SHA-256/AES-256-GCM/HMAC-SHA256 safe;
 * RSA-2048/ECDSA-P256/3DES not): symmetric primitives with an adequate
 * output/key length resist Grover's algorithm, asymmetric (factoring /
 * discrete-log) primitives do not resist Shor's algorithm regardless of key
 * size. Where the source doesn't reveal enough to apply that rule
 * confidently (e.g. an unspecified AES key length), this returns `null`
 * rather than guessing.
 */
import type { NormalizedCryptoUsage } from "./types";

interface CanonicalAlgorithm {
  name: string;
  primitive: string;
  keyLengthBits?: number | null;
  quantumSafe?: boolean | null;
}

/** Lowercases and strips separators so "SHA-256", "sha256", "Sha_256" all key the same. */
function collapseToken(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

const HASH_TABLE: Record<string, CanonicalAlgorithm> = {
  md5: { name: "MD5", primitive: "hash", keyLengthBits: null, quantumSafe: false },
  sha1: { name: "SHA-1", primitive: "hash", quantumSafe: false },
  sha224: { name: "SHA-224", primitive: "hash", quantumSafe: false },
  sha256: { name: "SHA-256", primitive: "hash", quantumSafe: true },
  sha384: { name: "SHA-384", primitive: "hash", quantumSafe: true },
  sha512: { name: "SHA-512", primitive: "hash", quantumSafe: true },
  sha3224: { name: "SHA3-224", primitive: "hash", quantumSafe: false },
  sha3256: { name: "SHA3-256", primitive: "hash", quantumSafe: true },
  sha3384: { name: "SHA3-384", primitive: "hash", quantumSafe: true },
  sha3512: { name: "SHA3-512", primitive: "hash", quantumSafe: true },
  ripemd160: { name: "RIPEMD-160", primitive: "hash", quantumSafe: false },
};

/** Resolves a raw digest token (e.g. "sha256", "SHA-256") to a canonical hash, or null if unrecognised. */
export function normalizeHashToken(raw: string): CanonicalAlgorithm | null {
  return HASH_TABLE[collapseToken(raw)] ?? null;
}

/** Parses an OpenSSL-style cipher spec such as "aes-256-gcm", "des-ede3-cbc", "chacha20-poly1305". */
export function normalizeCipherSpec(raw: string): (CanonicalAlgorithm & { mode?: string | null }) | null {
  const lower = raw.trim().toLowerCase();

  const aes = /^aes-?(128|192|256)-?(cbc|ecb|ctr|gcm|cfb|ofb|ccm|xts|kw|gcmsiv)?$/.exec(lower);
  if (aes) {
    const keyLengthBits = Number(aes[1]);
    return {
      name: `AES-${keyLengthBits}${aes[2] ? `-${aes[2].toUpperCase()}` : ""}`,
      primitive: "block-cipher",
      keyLengthBits,
      mode: aes[2] ?? null,
      quantumSafe: keyLengthBits === 256,
    };
  }

  if (/^des-?ede3|^3des|^des3/.test(lower)) {
    const mode = /-(cbc|ecb|cfb|ofb)$/.exec(lower)?.[1] ?? null;
    return { name: "3DES", primitive: "block-cipher", keyLengthBits: 168, mode, quantumSafe: false };
  }

  if (/^des-?(cbc|ecb|cfb|ofb)?$/.test(lower)) {
    const mode = /-(cbc|ecb|cfb|ofb)$/.exec(lower)?.[1] ?? null;
    return { name: "DES", primitive: "block-cipher", keyLengthBits: 56, mode, quantumSafe: false };
  }

  if (/^rc4/.test(lower)) {
    return { name: "RC4", primitive: "stream-cipher", keyLengthBits: null, quantumSafe: false };
  }

  if (/^chacha20-poly1305/.test(lower)) {
    return { name: "ChaCha20-Poly1305", primitive: "aead-cipher", keyLengthBits: 256, quantumSafe: true };
  }
  if (/^chacha20/.test(lower)) {
    return { name: "ChaCha20", primitive: "stream-cipher", keyLengthBits: 256, quantumSafe: true };
  }

  // Unrecognised cipher spec — surface the raw text rather than dropping it,
  // but never claim a key length or quantum-safety we can't support.
  return { name: raw.toUpperCase(), primitive: "cipher", keyLengthBits: null, quantumSafe: null };
}

/** Normalises a createSign/createVerify digest argument, e.g. "RSA-SHA256" or "sha256". */
export function normalizeSignatureDigest(raw: string): CanonicalAlgorithm {
  const lower = raw.trim().toLowerCase();
  const rsaSha = /^rsa-sha(\d+)$/.exec(lower);
  if (rsaSha) {
    return { name: `RSA-SHA${rsaSha[1]}`, primitive: "signature", quantumSafe: false };
  }
  const withSha = /^(ecdsa|dsa)-with-sha(\d+)$/.exec(lower);
  if (withSha) {
    return { name: `${withSha[1].toUpperCase()}-SHA${withSha[2]}`, primitive: "signature", quantumSafe: false };
  }
  const hash = normalizeHashToken(raw);
  if (hash) {
    // createSign/createVerify only operate over asymmetric keys (RSA, DSA, EC,
    // Ed25519/Ed448), so the overall signing operation is never quantum-safe
    // regardless of digest strength.
    return { name: hash.name, primitive: "signature", quantumSafe: false };
  }
  return { name: raw.toUpperCase(), primitive: "signature", quantumSafe: false };
}

const KEY_TYPE_TABLE: Record<string, CanonicalAlgorithm & { curve?: string | null }> = {
  rsa: { name: "RSA", primitive: "signature", quantumSafe: false },
  "rsa-pss": { name: "RSA-PSS", primitive: "signature", quantumSafe: false },
  dsa: { name: "DSA", primitive: "signature", quantumSafe: false },
  ec: { name: "EC", primitive: "signature", quantumSafe: false },
  ed25519: { name: "Ed25519", primitive: "signature", quantumSafe: false, curve: "Ed25519" },
  ed448: { name: "Ed448", primitive: "signature", quantumSafe: false, curve: "Ed448" },
  x25519: { name: "X25519", primitive: "key-exchange", quantumSafe: false, curve: "X25519" },
  x448: { name: "X448", primitive: "key-exchange", quantumSafe: false, curve: "X448" },
  dh: { name: "DH", primitive: "key-exchange", quantumSafe: false },
};

/** Normalises the first argument to generateKeyPair(Sync)/generateKey(Sync). */
export function normalizeKeyType(raw: string): (CanonicalAlgorithm & { curve?: string | null }) | null {
  return KEY_TYPE_TABLE[raw.trim().toLowerCase()] ?? null;
}

/** WebCrypto algorithm names (SubtleCrypto), keyed case-insensitively. */
const WEBCRYPTO_TABLE: Record<string, CanonicalAlgorithm> = {
  "sha-1": { name: "SHA-1", primitive: "hash", quantumSafe: false },
  "sha-256": { name: "SHA-256", primitive: "hash", quantumSafe: true },
  "sha-384": { name: "SHA-384", primitive: "hash", quantumSafe: true },
  "sha-512": { name: "SHA-512", primitive: "hash", quantumSafe: true },
  "aes-gcm": { name: "AES-GCM", primitive: "block-cipher", quantumSafe: null },
  "aes-cbc": { name: "AES-CBC", primitive: "block-cipher", quantumSafe: null },
  "aes-ctr": { name: "AES-CTR", primitive: "block-cipher", quantumSafe: null },
  "aes-kw": { name: "AES-KW", primitive: "key-wrap", quantumSafe: null },
  "rsa-oaep": { name: "RSA-OAEP", primitive: "encryption", quantumSafe: false },
  "rsa-pss": { name: "RSA-PSS", primitive: "signature", quantumSafe: false },
  "rsassa-pkcs1-v1_5": { name: "RSASSA-PKCS1-v1_5", primitive: "signature", quantumSafe: false },
  ecdsa: { name: "ECDSA", primitive: "signature", quantumSafe: false },
  ecdh: { name: "ECDH", primitive: "key-exchange", quantumSafe: false },
  hmac: { name: "HMAC", primitive: "mac", quantumSafe: true },
  hkdf: { name: "HKDF", primitive: "kdf", quantumSafe: true },
  pbkdf2: { name: "PBKDF2", primitive: "kdf", quantumSafe: true },
  ed25519: { name: "Ed25519", primitive: "signature", quantumSafe: false },
  x25519: { name: "X25519", primitive: "key-exchange", quantumSafe: false },
};

/** Normalises a WebCrypto (SubtleCrypto) algorithm name, e.g. "SHA-256", "AES-GCM". */
export function normalizeWebCryptoAlgorithm(raw: string): CanonicalAlgorithm | null {
  return WEBCRYPTO_TABLE[raw.trim().toLowerCase()] ?? null;
}

/**
 * Fixed execution-environment classification for every JS/TS call-site
 * detection in this rule pack: Node's `crypto` module and the browser/Node
 * WebCrypto API both execute entirely in-process, in plain RAM — there is
 * no other execution environment a static source match could indicate.
 */
export const SOFTWARE_EXECUTION_ENVIRONMENT = "software-plain-ram";

/**
 * Public-key algorithm *family* — Phase 4, Step 4 (certificate/key
 * detector). Distinct from KEY_TYPE_TABLE (keyed by generateKeyPair's type
 * argument) and WEBCRYPTO_TABLE (keyed by SubtleCrypto algorithm names,
 * which carry operation-specific primitives like "encryption"): this one
 * normalises the *identity* of a public/private key or a certificate's
 * public key — from either Node's `KeyObject.asymmetricKeyType` strings
 * ("rsa", "ec", "ed25519", …) or @peculiar/x509's WebCrypto-shaped
 * `publicKey.algorithm.name` ("RSASSA-PKCS1-v1_5", "ECDSA", …) — down to a
 * single canonical family name (RSA/DSA/EC/Ed25519/Ed448/X25519/X448). All
 * are classical, pre-quantum algorithms: quantumSafe is always false here,
 * regardless of key size, per IMPLEMENTATION_PLAN.md — Shor's algorithm
 * breaks factoring/discrete-log-based schemes at any classical key length.
 */
const PUBLIC_KEY_FAMILY_TABLE: Record<string, CanonicalAlgorithm> = {
  rsa: { name: "RSA", primitive: "signature", quantumSafe: false },
  "rsa-pss": { name: "RSA-PSS", primitive: "signature", quantumSafe: false },
  "rsa-oaep": { name: "RSA-OAEP", primitive: "encryption", quantumSafe: false },
  "rsassa-pkcs1-v1_5": { name: "RSA", primitive: "signature", quantumSafe: false },
  dsa: { name: "DSA", primitive: "signature", quantumSafe: false },
  ec: { name: "EC", primitive: "signature", quantumSafe: false },
  ecdsa: { name: "EC", primitive: "signature", quantumSafe: false },
  ecdh: { name: "EC", primitive: "key-exchange", quantumSafe: false },
  ed25519: { name: "Ed25519", primitive: "signature", quantumSafe: false },
  ed448: { name: "Ed448", primitive: "signature", quantumSafe: false },
  x25519: { name: "X25519", primitive: "key-exchange", quantumSafe: false },
  x448: { name: "X448", primitive: "key-exchange", quantumSafe: false },
};

/** Resolves a public/private key's algorithm family, or null if genuinely unrecognised (e.g. a future PQC OID). */
export function normalizePublicKeyFamily(raw: string): CanonicalAlgorithm | null {
  return PUBLIC_KEY_FAMILY_TABLE[raw.trim().toLowerCase()] ?? null;
}

/**
 * Canonical elliptic-curve names, keyed by every spelling this project's
 * parsers can hand back: OpenSSL/Node `asymmetricKeyDetails.namedCurve`
 * ("prime256v1", "secp384r1", …) and WebCrypto `namedCurve`
 * ("P-256", "P-384", …). Canonical form is the lowercase SEC1/OpenSSL name,
 * per IMPLEMENTATION_PLAN.md's own "secp256r1 / P-256" pairing.
 */
const CURVE_TABLE: Record<string, string> = {
  secp256r1: "secp256r1",
  prime256v1: "secp256r1",
  "p-256": "secp256r1",
  secp384r1: "secp384r1",
  "p-384": "secp384r1",
  secp521r1: "secp521r1",
  "p-521": "secp521r1",
  secp256k1: "secp256k1",
};

/**
 * Canonicalises a curve name's spelling. Unlike the other normalisers, an
 * unrecognised curve is passed through as-is (lowercased) rather than
 * dropped: the parser already gave us real, correctly-extracted ground
 * truth — canonicalising known spellings must not discard an exotic but
 * genuine curve name we simply don't have a mapping for.
 */
export function normalizeCurveName(raw: string): string {
  const trimmed = raw.trim();
  return CURVE_TABLE[trimmed.toLowerCase()] ?? trimmed;
}

export type { NormalizedCryptoUsage };
