/**
 * Central normalisation — every hit is canonicalised into the CBOM vocabulary
 * *once*, here, before it touches the database. If normalisation lived in the
 * detectors, the inventory would fill with "AES256", "aes-256-gcm" and
 * "AES_256_GCM" as three separate artefacts (IMPLEMENTATION_PLAN.md §4b).
 */
import type { CryptoKind, RawHit, NormalizedHit } from "./types";
import { fingerprint } from "./fingerprint";

interface AlgoProfile {
  canonicalName: string;
  primitive: string;
  keyLengthBits?: number;
  quantumSafe: boolean;
  nistQuantumLevel: number; // 0 = not quantum safe, 1-5 = NIST PQC security category
  classicalSecLevel: number; // bits of classical security
}

/**
 * Alias table — every spelling variant a detector might emit, mapped to one
 * canonical profile. Keys are matched case-insensitively against a
 * normalised (alnum-only) form of the raw name.
 */
const ALGO_TABLE: Record<string, AlgoProfile> = {
  des: { canonicalName: "DES", primitive: "block-cipher", keyLengthBits: 56, quantumSafe: false, nistQuantumLevel: 0, classicalSecLevel: 56 },
  "3des": { canonicalName: "3DES", primitive: "block-cipher", keyLengthBits: 168, quantumSafe: false, nistQuantumLevel: 0, classicalSecLevel: 112 },
  desede: { canonicalName: "3DES", primitive: "block-cipher", keyLengthBits: 168, quantumSafe: false, nistQuantumLevel: 0, classicalSecLevel: 112 },
  tripledes: { canonicalName: "3DES", primitive: "block-cipher", keyLengthBits: 168, quantumSafe: false, nistQuantumLevel: 0, classicalSecLevel: 112 },
  rc4: { canonicalName: "RC4", primitive: "stream-cipher", keyLengthBits: 128, quantumSafe: false, nistQuantumLevel: 0, classicalSecLevel: 40 },
  arcfour: { canonicalName: "RC4", primitive: "stream-cipher", keyLengthBits: 128, quantumSafe: false, nistQuantumLevel: 0, classicalSecLevel: 40 },
  blowfish: { canonicalName: "Blowfish", primitive: "block-cipher", keyLengthBits: 128, quantumSafe: false, nistQuantumLevel: 0, classicalSecLevel: 64 },
  aes128: { canonicalName: "AES-128", primitive: "block-cipher", keyLengthBits: 128, quantumSafe: true, nistQuantumLevel: 1, classicalSecLevel: 128 },
  aes192: { canonicalName: "AES-192", primitive: "block-cipher", keyLengthBits: 192, quantumSafe: true, nistQuantumLevel: 3, classicalSecLevel: 192 },
  aes256: { canonicalName: "AES-256", primitive: "block-cipher", keyLengthBits: 256, quantumSafe: true, nistQuantumLevel: 5, classicalSecLevel: 256 },
  aes: { canonicalName: "AES-128", primitive: "block-cipher", keyLengthBits: 128, quantumSafe: true, nistQuantumLevel: 1, classicalSecLevel: 128 },
  chacha20: { canonicalName: "ChaCha20-Poly1305", primitive: "stream-cipher", keyLengthBits: 256, quantumSafe: true, nistQuantumLevel: 5, classicalSecLevel: 256 },
  chacha20poly1305: { canonicalName: "ChaCha20-Poly1305", primitive: "stream-cipher", keyLengthBits: 256, quantumSafe: true, nistQuantumLevel: 5, classicalSecLevel: 256 },
  fernet: { canonicalName: "Fernet (AES-128-CBC+HMAC)", primitive: "authenticated-encryption", keyLengthBits: 128, quantumSafe: true, nistQuantumLevel: 1, classicalSecLevel: 128 },

  md5: { canonicalName: "MD5", primitive: "hash", keyLengthBits: 128, quantumSafe: false, nistQuantumLevel: 0, classicalSecLevel: 64 },
  sha1: { canonicalName: "SHA-1", primitive: "hash", keyLengthBits: 160, quantumSafe: false, nistQuantumLevel: 0, classicalSecLevel: 80 },
  sha224: { canonicalName: "SHA-224", primitive: "hash", keyLengthBits: 224, quantumSafe: true, nistQuantumLevel: 1, classicalSecLevel: 112 },
  sha256: { canonicalName: "SHA-256", primitive: "hash", keyLengthBits: 256, quantumSafe: true, nistQuantumLevel: 2, classicalSecLevel: 128 },
  sha384: { canonicalName: "SHA-384", primitive: "hash", keyLengthBits: 384, quantumSafe: true, nistQuantumLevel: 4, classicalSecLevel: 192 },
  sha512: { canonicalName: "SHA-512", primitive: "hash", keyLengthBits: 512, quantumSafe: true, nistQuantumLevel: 5, classicalSecLevel: 256 },
  sha3256: { canonicalName: "SHA3-256", primitive: "hash", keyLengthBits: 256, quantumSafe: true, nistQuantumLevel: 2, classicalSecLevel: 128 },
  sha3512: { canonicalName: "SHA3-512", primitive: "hash", keyLengthBits: 512, quantumSafe: true, nistQuantumLevel: 5, classicalSecLevel: 256 },

  hmacmd5: { canonicalName: "HMAC-MD5", primitive: "mac", keyLengthBits: 128, quantumSafe: false, nistQuantumLevel: 0, classicalSecLevel: 64 },
  hmacsha1: { canonicalName: "HMAC-SHA1", primitive: "mac", keyLengthBits: 160, quantumSafe: false, nistQuantumLevel: 0, classicalSecLevel: 80 },
  hmacsha256: { canonicalName: "HMAC-SHA256", primitive: "mac", keyLengthBits: 256, quantumSafe: true, nistQuantumLevel: 2, classicalSecLevel: 128 },
  hmacsha512: { canonicalName: "HMAC-SHA512", primitive: "mac", keyLengthBits: 512, quantumSafe: true, nistQuantumLevel: 5, classicalSecLevel: 256 },

  rsa1024: { canonicalName: "RSA-1024", primitive: "signature", keyLengthBits: 1024, quantumSafe: false, nistQuantumLevel: 0, classicalSecLevel: 80 },
  rsa2048: { canonicalName: "RSA-2048", primitive: "signature", keyLengthBits: 2048, quantumSafe: false, nistQuantumLevel: 0, classicalSecLevel: 112 },
  rsa3072: { canonicalName: "RSA-3072", primitive: "signature", keyLengthBits: 3072, quantumSafe: false, nistQuantumLevel: 0, classicalSecLevel: 128 },
  rsa4096: { canonicalName: "RSA-4096", primitive: "signature", keyLengthBits: 4096, quantumSafe: false, nistQuantumLevel: 0, classicalSecLevel: 152 },
  rsapss: { canonicalName: "RSA-PSS", primitive: "signature", keyLengthBits: 2048, quantumSafe: false, nistQuantumLevel: 0, classicalSecLevel: 112 },

  ecdsap256: { canonicalName: "ECDSA-P256", primitive: "signature", keyLengthBits: 256, quantumSafe: false, nistQuantumLevel: 0, classicalSecLevel: 128 },
  ecdsap384: { canonicalName: "ECDSA-P384", primitive: "signature", keyLengthBits: 384, quantumSafe: false, nistQuantumLevel: 0, classicalSecLevel: 192 },
  ecdsa: { canonicalName: "ECDSA-P256", primitive: "signature", keyLengthBits: 256, quantumSafe: false, nistQuantumLevel: 0, classicalSecLevel: 128 },
  ed25519: { canonicalName: "Ed25519", primitive: "signature", keyLengthBits: 256, quantumSafe: false, nistQuantumLevel: 0, classicalSecLevel: 128 },
  ecdh: { canonicalName: "ECDH-P256", primitive: "key-agreement", keyLengthBits: 256, quantumSafe: false, nistQuantumLevel: 0, classicalSecLevel: 128 },
  x25519: { canonicalName: "X25519", primitive: "key-agreement", keyLengthBits: 256, quantumSafe: false, nistQuantumLevel: 0, classicalSecLevel: 128 },
  dh: { canonicalName: "Diffie-Hellman", primitive: "key-agreement", keyLengthBits: 2048, quantumSafe: false, nistQuantumLevel: 0, classicalSecLevel: 112 },

  mlkem768: { canonicalName: "ML-KEM-768", primitive: "key-agreement", keyLengthBits: 1184, quantumSafe: true, nistQuantumLevel: 3, classicalSecLevel: 192 },
  mlkem1024: { canonicalName: "ML-KEM-1024", primitive: "key-agreement", keyLengthBits: 1568, quantumSafe: true, nistQuantumLevel: 5, classicalSecLevel: 256 },
  kyber768: { canonicalName: "ML-KEM-768", primitive: "key-agreement", keyLengthBits: 1184, quantumSafe: true, nistQuantumLevel: 3, classicalSecLevel: 192 },
  x25519mlkem768: { canonicalName: "X25519MLKEM768", primitive: "key-agreement", keyLengthBits: 1184, quantumSafe: true, nistQuantumLevel: 3, classicalSecLevel: 192 },
  mldsa65: { canonicalName: "ML-DSA-65", primitive: "signature", keyLengthBits: 1952, quantumSafe: true, nistQuantumLevel: 3, classicalSecLevel: 192 },
  dilithium3: { canonicalName: "ML-DSA-65", primitive: "signature", keyLengthBits: 1952, quantumSafe: true, nistQuantumLevel: 3, classicalSecLevel: 192 },
  slhdsasha2128s: { canonicalName: "SLH-DSA-SHA2-128s", primitive: "signature", keyLengthBits: 32, quantumSafe: true, nistQuantumLevel: 1, classicalSecLevel: 128 },

  bcrypt: { canonicalName: "bcrypt", primitive: "password-hash", quantumSafe: true, nistQuantumLevel: 1, classicalSecLevel: 128 },
  pbkdf2: { canonicalName: "PBKDF2", primitive: "password-hash", quantumSafe: true, nistQuantumLevel: 1, classicalSecLevel: 128 },
  scrypt: { canonicalName: "scrypt", primitive: "password-hash", quantumSafe: true, nistQuantumLevel: 1, classicalSecLevel: 128 },
  argon2: { canonicalName: "argon2", primitive: "password-hash", quantumSafe: true, nistQuantumLevel: 1, classicalSecLevel: 128 },

  // JWT `alg` header values
  hs256: { canonicalName: "HMAC-SHA256", primitive: "mac", keyLengthBits: 256, quantumSafe: true, nistQuantumLevel: 2, classicalSecLevel: 128 },
  hs384: { canonicalName: "HMAC-SHA384", primitive: "mac", keyLengthBits: 384, quantumSafe: true, nistQuantumLevel: 4, classicalSecLevel: 192 },
  hs512: { canonicalName: "HMAC-SHA512", primitive: "mac", keyLengthBits: 512, quantumSafe: true, nistQuantumLevel: 5, classicalSecLevel: 256 },
  rs256: { canonicalName: "RSA-2048 (RS256)", primitive: "signature", keyLengthBits: 2048, quantumSafe: false, nistQuantumLevel: 0, classicalSecLevel: 112 },
  rs384: { canonicalName: "RSA-3072 (RS384)", primitive: "signature", keyLengthBits: 3072, quantumSafe: false, nistQuantumLevel: 0, classicalSecLevel: 128 },
  rs512: { canonicalName: "RSA-4096 (RS512)", primitive: "signature", keyLengthBits: 4096, quantumSafe: false, nistQuantumLevel: 0, classicalSecLevel: 152 },
  ps256: { canonicalName: "RSA-PSS-2048 (PS256)", primitive: "signature", keyLengthBits: 2048, quantumSafe: false, nistQuantumLevel: 0, classicalSecLevel: 112 },
  es256: { canonicalName: "ECDSA-P256 (ES256)", primitive: "signature", keyLengthBits: 256, quantumSafe: false, nistQuantumLevel: 0, classicalSecLevel: 128 },

  // Hand-rolled / proprietary
  xorobfuscation: { canonicalName: "XOR-Obfuscation", primitive: "proprietary", keyLengthBits: 8, quantumSafe: false, nistQuantumLevel: 0, classicalSecLevel: 0 },
};

function normKey(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Longest-alias-first lookup so "aes256gcm" resolves to aes256, not aes. */
const sortedKeys = Object.keys(ALGO_TABLE).sort((a, b) => b.length - a.length);

export function lookupAlgoProfile(rawName: string): AlgoProfile | undefined {
  const key = normKey(rawName);
  if (ALGO_TABLE[key]) return ALGO_TABLE[key];
  for (const candidate of sortedKeys) {
    if (key.includes(candidate)) return ALGO_TABLE[candidate];
  }
  return undefined;
}

export function normalizeHit(
  repositoryId: string,
  hit: RawHit
): NormalizedHit {
  const profile = hit.kind === "ALGORITHM" ? lookupAlgoProfile(hit.rawName) : undefined;

  const canonicalName = profile?.canonicalName ?? hit.rawName.trim();
  const primitive = hit.primitive ?? profile?.primitive;
  const keyLengthBits = hit.keyLengthBits ?? profile?.keyLengthBits;
  const quantumSafe = hit.quantumSafe ?? profile?.quantumSafe;
  const nistQuantumLevel = hit.nistQuantumLevel ?? profile?.nistQuantumLevel;
  const classicalSecLevel = hit.classicalSecLevel ?? profile?.classicalSecLevel;

  const normalized: RawHit = {
    ...hit,
    algorithm: hit.algorithm ?? canonicalName,
    primitive,
    keyLengthBits,
    quantumSafe,
    nistQuantumLevel,
    classicalSecLevel,
    executionEnvironment: hit.executionEnvironment ?? "software-plain-ram",
  };

  const fp = fingerprint({
    repositoryId,
    ruleId: hit.ruleId,
    canonicalName,
    mode: hit.mode,
    keyLengthBits,
    filePath: hit.filePath,
  });

  return { ...normalized, canonicalName, fingerprint: fp };
}

export function kindLabel(kind: CryptoKind): string {
  const m: Record<CryptoKind, string> = {
    ALGORITHM: "Algorithm",
    CERTIFICATE: "Certificate",
    KEY: "Key",
    PROTOCOL: "Protocol",
    LIBRARY: "Library",
    SECRET: "Secret",
  };
  return m[kind];
}
