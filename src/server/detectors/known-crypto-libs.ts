/**
 * Curated catalogue of npm packages known to implement or wrap
 * cryptographic functionality — Phase 4, Step 3.
 *
 * Matching against this catalogue is exact by npm package name (never
 * substring/fuzzy) — see manifest-scan.ts.
 *
 * `quantumSafe` is left `null` whenever a library's quantum-safety
 * genuinely depends on which algorithm/curve/mode the caller selects at
 * runtime (true for most general-purpose toolkits and JOSE/PGP libraries,
 * which support both classical-safe and classically-broken choices) —
 * never guessed just because the library *can* be used with a modern
 * algorithm. `false` is used only where the entire package is scoped to
 * one family of primitives that is inherently not quantum-safe regardless
 * of how it's called (e.g. `elliptic`, which implements only elliptic-curve
 * cryptography).
 */

export type KnownLibraryCategory = "jwt" | "hashing" | "general" | "pki" | "pgp";

export interface KnownCryptoLibrary {
  packageName: string;
  displayName: string;
  category: KnownLibraryCategory;
  quantumSafe: boolean | null;
}

const CATALOGUE: readonly KnownCryptoLibrary[] = [
  { packageName: "node-forge", displayName: "node-forge", category: "general", quantumSafe: null },
  { packageName: "jsonwebtoken", displayName: "jsonwebtoken", category: "jwt", quantumSafe: null },
  { packageName: "jose", displayName: "jose", category: "jwt", quantumSafe: null },
  { packageName: "bcrypt", displayName: "bcrypt", category: "hashing", quantumSafe: null },
  { packageName: "bcryptjs", displayName: "bcrypt.js", category: "hashing", quantumSafe: null },
  { packageName: "argon2", displayName: "argon2", category: "hashing", quantumSafe: null },
  { packageName: "crypto-js", displayName: "CryptoJS", category: "general", quantumSafe: null },
  { packageName: "tweetnacl", displayName: "TweetNaCl.js", category: "general", quantumSafe: null },
  { packageName: "libsodium-wrappers", displayName: "libsodium", category: "general", quantumSafe: null },
  { packageName: "@peculiar/x509", displayName: "PeculiarVentures X509", category: "pki", quantumSafe: null },
  { packageName: "node-jose", displayName: "node-jose", category: "jwt", quantumSafe: null },
  { packageName: "openpgp", displayName: "OpenPGP.js", category: "pgp", quantumSafe: null },
  // elliptic implements only elliptic-curve primitives (ECDSA/ECDH/EdDSA) —
  // there is no usage of this package that isn't Shor-vulnerable.
  { packageName: "elliptic", displayName: "elliptic", category: "general", quantumSafe: false },
  { packageName: "paseto", displayName: "PASETO", category: "general", quantumSafe: null },
];

const CATALOGUE_BY_NAME: ReadonlyMap<string, KnownCryptoLibrary> = new Map(
  CATALOGUE.map((entry) => [entry.packageName, entry])
);

/** Exact npm package-name lookup — never substring/fuzzy matched. */
export function findKnownLibrary(packageName: string): KnownCryptoLibrary | null {
  return CATALOGUE_BY_NAME.get(packageName) ?? null;
}

export function listKnownLibraries(): readonly KnownCryptoLibrary[] {
  return CATALOGUE;
}
