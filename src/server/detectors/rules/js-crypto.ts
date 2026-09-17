/**
 * JS/TS cryptographic call-site rule pack — Phase 4, Step 2.
 *
 * Structured, typed rules per src/server/detectors/types.ts — no inline
 * regexes scattered inside the scanner or detector engine. Each rule matches
 * one call-site pattern and normalises it via src/server/detectors/normalize.ts
 * so the same raw token always produces the same canonical asset regardless
 * of which rule matched it.
 *
 * Matching is deliberately source-level (line-by-line regex), not a real
 * JS/TS parser — sufficient for this phase per IMPLEMENTATION_PLAN.md 4a.
 * A bare call like `createHash(...)` is matched the same as `crypto.createHash(...)`,
 * which covers both `import { createHash } from "crypto"` and
 * `const { createHash } = require("crypto")` without needing to track imports.
 */
import {
  normalizeCipherSpec,
  normalizeHashToken,
  normalizeKeyType,
  normalizeSignatureDigest,
  normalizeWebCryptoAlgorithm,
  SOFTWARE_EXECUTION_ENVIRONMENT,
} from "../normalize";
import type { CryptoRule, NormalizedCryptoUsage } from "../types";
import { assertValidRulePack } from "../types";

const JS_TS_LANGUAGES = ["javascript", "typescript"] as const;
const JS_TS_FILE_PATTERNS = ["**/*.js", "**/*.jsx", "**/*.ts", "**/*.tsx", "**/*.mjs", "**/*.cjs"] as const;

/** A quoted string literal argument: 'sha256', "sha256", or `sha256`. */
const QUOTED = `["'\`]([A-Za-z0-9_-]+)["'\`]`;

function hashUsage(token: string): NormalizedCryptoUsage | null {
  const hash = normalizeHashToken(token);
  if (!hash) return null;
  return {
    kind: "ALGORITHM",
    name: hash.name,
    primitive: hash.primitive,
    algorithm: hash.name,
    keyLengthBits: hash.keyLengthBits ?? null,
    quantumSafe: hash.quantumSafe ?? null,
    executionEnvironment: SOFTWARE_EXECUTION_ENVIRONMENT,
  };
}

// ─── Node.js `crypto` module ────────────────────────────────────────────────

const createHash: CryptoRule = {
  id: "js.node.createHash",
  pack: "js-crypto",
  languages: JS_TS_LANGUAGES,
  filePatterns: JS_TS_FILE_PATTERNS,
  pattern: new RegExp(`\\bcreateHash\\s*\\(\\s*${QUOTED}`, "g"),
  severity: "MODERATE",
  cweId: "CWE-327",
  nistRef: "SP 800-131A",
  extract: (match) => hashUsage(match[1]),
};

const createHmac: CryptoRule = {
  id: "js.node.createHmac",
  pack: "js-crypto",
  languages: JS_TS_LANGUAGES,
  filePatterns: JS_TS_FILE_PATTERNS,
  pattern: new RegExp(`\\bcreateHmac\\s*\\(\\s*${QUOTED}`, "g"),
  severity: "LOW",
  cweId: "CWE-327",
  extract: (match) => {
    const hash = normalizeHashToken(match[1]);
    if (!hash) return null;
    return {
      kind: "ALGORITHM",
      name: `HMAC-${hash.name}`,
      primitive: "mac",
      algorithm: hash.name,
      quantumSafe: hash.quantumSafe ?? null,
      executionEnvironment: SOFTWARE_EXECUTION_ENVIRONMENT,
    };
  },
};

function cipherUsage(token: string): NormalizedCryptoUsage {
  const cipher = normalizeCipherSpec(token)!; // normalizeCipherSpec never returns null
  return {
    kind: "ALGORITHM",
    name: cipher.name,
    primitive: cipher.primitive,
    algorithm: cipher.name,
    keyLengthBits: cipher.keyLengthBits ?? null,
    mode: cipher.mode ?? null,
    quantumSafe: cipher.quantumSafe ?? null,
    executionEnvironment: SOFTWARE_EXECUTION_ENVIRONMENT,
  };
}

const createCipheriv: CryptoRule = {
  id: "js.node.createCipheriv",
  pack: "js-crypto",
  languages: JS_TS_LANGUAGES,
  filePatterns: JS_TS_FILE_PATTERNS,
  pattern: new RegExp(`\\bcreateCipheriv\\s*\\(\\s*${QUOTED}`, "g"),
  severity: "MODERATE",
  cweId: "CWE-327",
  extract: (match) => cipherUsage(match[1]),
};

const createDecipheriv: CryptoRule = {
  id: "js.node.createDecipheriv",
  pack: "js-crypto",
  languages: JS_TS_LANGUAGES,
  filePatterns: JS_TS_FILE_PATTERNS,
  pattern: new RegExp(`\\bcreateDecipheriv\\s*\\(\\s*${QUOTED}`, "g"),
  severity: "MODERATE",
  cweId: "CWE-327",
  extract: (match) => cipherUsage(match[1]),
};

function signatureUsage(token: string): NormalizedCryptoUsage {
  const sig = normalizeSignatureDigest(token);
  return {
    kind: "ALGORITHM",
    name: sig.name,
    primitive: "signature",
    algorithm: sig.name,
    quantumSafe: false,
    executionEnvironment: SOFTWARE_EXECUTION_ENVIRONMENT,
  };
}

const createSign: CryptoRule = {
  id: "js.node.createSign",
  pack: "js-crypto",
  languages: JS_TS_LANGUAGES,
  filePatterns: JS_TS_FILE_PATTERNS,
  pattern: new RegExp(`\\bcreateSign\\s*\\(\\s*${QUOTED}`, "g"),
  severity: "LOW",
  cweId: "CWE-327",
  extract: (match) => signatureUsage(match[1]),
};

const createVerify: CryptoRule = {
  id: "js.node.createVerify",
  pack: "js-crypto",
  languages: JS_TS_LANGUAGES,
  filePatterns: JS_TS_FILE_PATTERNS,
  pattern: new RegExp(`\\bcreateVerify\\s*\\(\\s*${QUOTED}`, "g"),
  severity: "LOW",
  cweId: "CWE-327",
  extract: (match) => signatureUsage(match[1]),
};

const generateKeyPair: CryptoRule = {
  id: "js.node.generateKeyPair",
  pack: "js-crypto",
  languages: JS_TS_LANGUAGES,
  filePatterns: JS_TS_FILE_PATTERNS,
  pattern: new RegExp(`\\bgenerateKeyPair(?:Sync)?\\s*\\(\\s*${QUOTED}`, "g"),
  severity: "LOW",
  cweId: "CWE-326",
  extract: (match) => {
    const keyType = normalizeKeyType(match[1]);
    if (!keyType) return null;
    return {
      kind: "ALGORITHM",
      name: keyType.name,
      primitive: keyType.primitive,
      algorithm: keyType.name,
      curve: keyType.curve ?? null,
      quantumSafe: keyType.quantumSafe ?? null,
      executionEnvironment: SOFTWARE_EXECUTION_ENVIRONMENT,
    };
  },
};

const generateKey: CryptoRule = {
  id: "js.node.generateKey",
  pack: "js-crypto",
  languages: JS_TS_LANGUAGES,
  filePatterns: JS_TS_FILE_PATTERNS,
  // Negative lookahead keeps this from matching generateKeyPair(Sync)?(...).
  pattern: new RegExp(`\\bgenerateKey(?:Sync)?\\s*(?!Pair)\\(\\s*${QUOTED}`, "g"),
  severity: "LOW",
  cweId: "CWE-326",
  extract: (match) => {
    const type = match[1].trim().toLowerCase();
    if (type === "hmac") {
      return {
        kind: "ALGORITHM",
        name: "HMAC",
        primitive: "mac",
        algorithm: "HMAC",
        quantumSafe: true,
        executionEnvironment: SOFTWARE_EXECUTION_ENVIRONMENT,
      };
    }
    if (type === "aes") {
      return {
        kind: "ALGORITHM",
        name: "AES",
        primitive: "block-cipher",
        algorithm: "AES",
        // Key length isn't statically known from generateKey('aes', {length}) —
        // the length lives in a sibling options object we don't parse here.
        keyLengthBits: null,
        quantumSafe: null,
        executionEnvironment: SOFTWARE_EXECUTION_ENVIRONMENT,
      };
    }
    return null;
  },
};

const diffieHellman: CryptoRule = {
  id: "js.node.diffieHellman",
  pack: "js-crypto",
  languages: JS_TS_LANGUAGES,
  filePatterns: JS_TS_FILE_PATTERNS,
  pattern: /\b(?:createDiffieHellman|diffieHellman)\s*\(/g,
  severity: "MODERATE",
  cweId: "CWE-326",
  extract: () => ({
    kind: "ALGORITHM",
    name: "DH",
    primitive: "key-exchange",
    algorithm: "DH",
    quantumSafe: false,
    executionEnvironment: SOFTWARE_EXECUTION_ENVIRONMENT,
  }),
};

const ecdh: CryptoRule = {
  id: "js.node.ecdh",
  pack: "js-crypto",
  languages: JS_TS_LANGUAGES,
  filePatterns: JS_TS_FILE_PATTERNS,
  pattern: new RegExp(`\\b(?:createECDH|ecdh)\\s*\\(\\s*(?:${QUOTED})?`, "g"),
  severity: "MODERATE",
  cweId: "CWE-326",
  extract: (match) => ({
    kind: "ALGORITHM",
    name: "ECDH",
    primitive: "key-exchange",
    algorithm: "ECDH",
    curve: match[1] ?? null,
    quantumSafe: false,
    executionEnvironment: SOFTWARE_EXECUTION_ENVIRONMENT,
  }),
};

// ─── WebCrypto (`crypto.subtle`) ────────────────────────────────────────────

/** algorithmName can be a bare string literal or `{ name: "..." }`. */
const SUBTLE_ALGO = `(?:${QUOTED}|\\{[^}]*?name\\s*:\\s*${QUOTED})`;

function webCryptoUsage(match: RegExpExecArray): NormalizedCryptoUsage | null {
  const raw = match[1] ?? match[2];
  if (!raw) return null;
  const algo = normalizeWebCryptoAlgorithm(raw) ?? normalizeHashToken(raw);
  if (!algo) return null;
  return {
    kind: "ALGORITHM",
    name: algo.name,
    primitive: algo.primitive,
    algorithm: algo.name,
    quantumSafe: algo.quantumSafe ?? null,
    executionEnvironment: SOFTWARE_EXECUTION_ENVIRONMENT,
  };
}

function webCryptoRule(method: string, id: string, severity: CryptoRule["severity"]): CryptoRule {
  return {
    id,
    pack: "js-crypto",
    languages: JS_TS_LANGUAGES,
    filePatterns: JS_TS_FILE_PATTERNS,
    pattern: new RegExp(`\\bsubtle\\s*\\.\\s*${method}\\s*\\(\\s*${SUBTLE_ALGO}`, "g"),
    severity,
    cweId: "CWE-327",
    extract: webCryptoUsage,
  };
}

const webcryptoDigest = webCryptoRule("digest", "js.webcrypto.subtle.digest", "MODERATE");
const webcryptoEncrypt = webCryptoRule("encrypt", "js.webcrypto.subtle.encrypt", "MODERATE");
const webcryptoDecrypt = webCryptoRule("decrypt", "js.webcrypto.subtle.decrypt", "MODERATE");
const webcryptoSign = webCryptoRule("sign", "js.webcrypto.subtle.sign", "LOW");
const webcryptoVerify = webCryptoRule("verify", "js.webcrypto.subtle.verify", "LOW");
const webcryptoGenerateKey = webCryptoRule("generateKey", "js.webcrypto.subtle.generateKey", "LOW");
const webcryptoDeriveKey = webCryptoRule("deriveKey", "js.webcrypto.subtle.deriveKey", "LOW");
const webcryptoDeriveBits = webCryptoRule("deriveBits", "js.webcrypto.subtle.deriveBits", "LOW");

export const JS_CRYPTO_RULES: readonly CryptoRule[] = [
  createHash,
  createHmac,
  createCipheriv,
  createDecipheriv,
  createSign,
  createVerify,
  generateKeyPair,
  generateKey,
  diffieHellman,
  ecdh,
  webcryptoDigest,
  webcryptoEncrypt,
  webcryptoDecrypt,
  webcryptoSign,
  webcryptoVerify,
  webcryptoGenerateKey,
  webcryptoDeriveKey,
  webcryptoDeriveBits,
];

assertValidRulePack(JS_CRYPTO_RULES);
