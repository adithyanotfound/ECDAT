/**
 * PQC + hybrid recommendations with latency and effort estimates.
 * (IMPLEMENTATION_PLAN.md §4c "Recommendations")
 */
import type { NormalizedHit } from "./types";

export interface RecommendationRow {
  fromAlgorithm: string;
  toAlgorithm: string;
  standard: string;
  effort: "LOW" | "MEDIUM" | "HIGH";
  latencyImpact: string;
  sizeImpact: string;
  notes: string;
}

interface RecoRule {
  match: (name: string, primitive?: string) => boolean;
  row: Omit<RecommendationRow, "fromAlgorithm">;
}

const RECO_TABLE: RecoRule[] = [
  {
    match: (n, p) => /^RSA(-\d+)?/.test(n) && p === "key-agreement",
    row: { toAlgorithm: "ML-KEM-768", standard: "FIPS 203", effort: "MEDIUM", latencyImpact: "Comparable", sizeImpact: "Larger ciphertext (~1KB)", notes: "Replace RSA key exchange with a PQC KEM." },
  },
  {
    match: (n) => /^X25519$/.test(n),
    row: { toAlgorithm: "X25519MLKEM768", standard: "FIPS 203 + RFC 9370", effort: "LOW", latencyImpact: "+1 RTT payload", sizeImpact: "+1KB handshake", notes: "Hybrid classical+PQC key exchange, safe default for TLS 1.3." },
  },
  {
    match: (n) => /^ECDSA/.test(n),
    row: { toAlgorithm: "ML-DSA-65", standard: "FIPS 204", effort: "MEDIUM", latencyImpact: "Larger signatures", sizeImpact: "~2.4KB signature (vs 64B)", notes: "Migrate ECDSA signing to a PQC signature scheme." },
  },
  {
    match: (n) => /^RSA(-\d+)?(\s|$|\s\(RS)/.test(n) || /RS256|RS384|RS512/.test(n),
    row: { toAlgorithm: "ML-DSA-65", standard: "FIPS 204", effort: "MEDIUM", latencyImpact: "Larger signatures", sizeImpact: "~2.4KB signature", notes: "Migrate RSA signing (including JWT RS256/384/512) to ML-DSA-65." },
  },
  {
    match: (n) => /RSA-PSS|PS256/.test(n),
    row: { toAlgorithm: "SLH-DSA-SHA2-128s", standard: "FIPS 205", effort: "HIGH", latencyImpact: "Slow sign, fast verify", sizeImpact: "~7.8KB signature", notes: "Stateless hash-based signature for firmware/code-signing use cases." },
  },
  {
    match: (n) => /^3DES/.test(n),
    row: { toAlgorithm: "AES-256-GCM", standard: "NIST SP 800-38D", effort: "LOW", latencyImpact: "Faster", sizeImpact: "Same", notes: "Drop-in replacement; also gains authenticated encryption." },
  },
  {
    match: (n) => /^DES$/.test(n),
    row: { toAlgorithm: "AES-256-GCM", standard: "NIST SP 800-38D", effort: "LOW", latencyImpact: "Faster", sizeImpact: "Same", notes: "DES is fully broken; replace immediately." },
  },
  {
    match: (n) => /^RC4$/.test(n),
    row: { toAlgorithm: "ChaCha20-Poly1305", standard: "RFC 8439", effort: "LOW", latencyImpact: "Faster", sizeImpact: "Same", notes: "RC4 is prohibited by RFC 7465." },
  },
  {
    match: (n) => /^(SHA-1|MD5)/.test(n),
    row: { toAlgorithm: "SHA-256 / SHA3-256", standard: "FIPS 180-4 / FIPS 202", effort: "LOW", latencyImpact: "Comparable", sizeImpact: "Larger digest", notes: "Collision-vulnerable; replace in all integrity and signature contexts." },
  },
  {
    match: (n) => /^HMAC-(MD5|SHA1)/.test(n),
    row: { toAlgorithm: "HMAC-SHA256", standard: "FIPS 198-1", effort: "LOW", latencyImpact: "Comparable", sizeImpact: "Same", notes: "Replace the underlying hash function." },
  },
  {
    match: (n) => /^XOR-Obfuscation$/.test(n),
    row: { toAlgorithm: "AES-256-GCM", standard: "NIST SP 800-38D", effort: "HIGH", latencyImpact: "Comparable", sizeImpact: "+16B auth tag", notes: "XOR is not encryption; replace with an authenticated cipher and a real key management story." },
  },
  {
    match: (n) => /JWT alg=none/.test(n),
    row: { toAlgorithm: "RS256 or ES256 (then ML-DSA-65)", standard: "RFC 7518", effort: "LOW", latencyImpact: "N/A", sizeImpact: "N/A", notes: "Tokens are currently unsigned — this accepts forged tokens. Enforce a signing algorithm allowlist server-side." },
  },
];

export function getRecommendation(hit: NormalizedHit): RecommendationRow | null {
  if (hit.kind !== "ALGORITHM" || hit.quantumSafe !== false) {
    if (hit.canonicalName !== "XOR-Obfuscation" && hit.canonicalName !== "JWT alg=none") return null;
  }
  const rule = RECO_TABLE.find((r) => r.match(hit.canonicalName, hit.primitive));
  if (!rule) return null;
  return { fromAlgorithm: hit.canonicalName, ...rule.row };
}
