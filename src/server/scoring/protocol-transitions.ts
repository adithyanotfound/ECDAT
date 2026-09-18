/**
 * Protocol/cipher-suite-name transition table — Phase 5, Step 8.
 *
 * Deliberately SEPARATE from deprecated-algorithms.ts: that table's entries
 * are cryptographic *algorithms* (MD5, RSA, EC curves), keyed and scored by
 * algorithm name/key-length/curve. TLS protocol *versions* ("TLSv1.1") and
 * SSH KEX/cipher/MAC *names* ("diffie-hellman-group1-sha1", "blowfish-cbc")
 * are configuration identifiers, not algorithms in that sense — mapping them
 * onto the algorithm table would be the "blindly map protocol names to
 * algorithm names" mistake the Step 8 spec explicitly warns against.
 *
 * Reuse, not duplication: src/server/findings/derive.ts consults this table
 * ONLY as a fallback, after first checking deprecated-algorithms.ts's own
 * lookupTransitionStatus() — so an SSH cipher/MAC that already reduces to a
 * known-weak algorithm (3des-cbc -> 3DES, hmac-md5 -> MD5, hmac-sha1 -> SHA-1,
 * arcfour -> RC4) is classified via the EXISTING table, never re-decided
 * here. This file only covers identifiers that table has no notion of at
 * all: TLS/SSL protocol versions, and SSH-specific names with no equivalent
 * entry in deprecated-algorithms.ts's FLAT_TABLE (Blowfish, CAST128,
 * DH-group1).
 *
 * POLICY SOURCE (TLS versions):
 *   - SSLv2 / SSLv3: disallowed — broken protocols (POODLE et al.), removed
 *     from every current TLS library.
 *   - TLSv1.0 / TLSv1.1: disallowed — RFC 8996 (March 2021) formally
 *     deprecates both; NIST SP 800-52 Rev.2 and PCI-DSS 4.0 also disallow
 *     them. Both TLSv1.0 and TLSv1.1 are treated identically (disallowed,
 *     not "legacy") because RFC 8996 draws no distinction between them.
 *   - TLSv1.2: acceptable — still the deployed floor almost everywhere.
 *   - TLSv1.3: recommended — current best practice (RFC 8446).
 *
 * POLICY SOURCE (SSH):
 *   - diffie-hellman-group1-sha1: disallowed — SHA-1 KEX over a 768-bit MODP
 *     group, factorable with modest resources (Logjam-class). This is the
 *     exact weak KEX IMPLEMENTATION_PLAN.md's `ecdat-demo-platform-infra`
 *     demo repository plants as a finding.
 *   - diffie-hellman-group14-sha1: legacy — SHA-1-based but a 2048-bit
 *     group; still commonly deployed, but SHA-1 in the transcript hash is a
 *     known weakening (superseded by the *-sha256 variant).
 *   - blowfish-cbc / cast128-cbc: legacy — 64-bit-block ciphers, vulnerable
 *     to birthday-bound collision attacks on large transfers (Sweet32-class,
 *     the same class of attack that makes 3DES disallowed in the algorithm
 *     table); kept at "legacy" rather than "disallowed" since, unlike 3DES,
 *     no NIST/RFC document formally disallows them for SSH specifically.
 *   - Everything else (aes*-gcm, aes*-ctr, chacha20-poly1305, curve25519-*,
 *     ecdh-sha2-*, hmac-sha2-*) is intentionally left unclassified here —
 *     no invented policy for algorithms this project has no documented
 *     position on.
 */
import type { DeprecatedAlgorithmEntry, TransitionStatus } from "./deprecated-algorithms";

interface ProtocolTransitionEntry {
  status: TransitionStatus;
  explanation: string;
}

const TLS_VERSION_TABLE: Record<string, ProtocolTransitionEntry> = {
  "SSLv2": {
    status: "disallowed",
    explanation: "SSLv2 is fundamentally broken and has been removed from every current TLS library; disallowed.",
  },
  "SSLv3": {
    status: "disallowed",
    explanation: "SSLv3 is vulnerable to POODLE and is disallowed by every current TLS policy.",
  },
  "TLSv1.0": {
    status: "disallowed",
    explanation: "TLSv1.0 is formally deprecated by RFC 8996 (2021) and disallowed under NIST SP 800-52 Rev.2.",
  },
  "TLSv1.1": {
    status: "disallowed",
    explanation: "TLSv1.1 is formally deprecated by RFC 8996 (2021) and disallowed under NIST SP 800-52 Rev.2.",
  },
  "TLSv1.2": {
    status: "acceptable",
    explanation: "TLSv1.2 is still an acceptable, widely-deployed protocol floor.",
  },
  "TLSv1.3": {
    status: "recommended",
    explanation: "TLSv1.3 (RFC 8446) is the current recommended protocol version.",
  },
};

const SSH_TABLE: Record<string, ProtocolTransitionEntry> = {
  "diffie-hellman-group1-sha1": {
    status: "disallowed",
    explanation:
      "diffie-hellman-group1-sha1 uses a 768-bit MODP group and SHA-1, both factorable/breakable with modest resources; disallowed.",
  },
  "diffie-hellman-group14-sha1": {
    status: "legacy",
    explanation:
      "diffie-hellman-group14-sha1 uses a 2048-bit group but hashes the exchange with SHA-1; superseded by the -sha256 variant.",
  },
  "blowfish-cbc": {
    status: "legacy",
    explanation: "blowfish-cbc is a 64-bit-block cipher, vulnerable to birthday-bound collision attacks on large transfers.",
  },
  "cast128-cbc": {
    status: "legacy",
    explanation: "cast128-cbc is a 64-bit-block cipher, vulnerable to birthday-bound collision attacks on large transfers.",
  },
};

/**
 * Resolves transition status for a protocol-version or SSH KEX/cipher/MAC
 * identifier this project has an explicit, documented position on. Returns
 * null for anything not in these two small tables — callers must treat that
 * as "no opinion", never as "safe" (same contract as deprecated-algorithms.ts's
 * lookupTransitionStatus).
 */
export function lookupProtocolTransitionStatus(identifier: string | null): DeprecatedAlgorithmEntry | null {
  if (!identifier) return null;

  const tlsEntry = TLS_VERSION_TABLE[identifier];
  if (tlsEntry) return { algorithm: identifier, status: tlsEntry.status, explanation: tlsEntry.explanation };

  const sshEntry = SSH_TABLE[identifier.toLowerCase()];
  if (sshEntry) return { algorithm: identifier, status: sshEntry.status, explanation: sshEntry.explanation };

  return null;
}
