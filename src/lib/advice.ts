/**
 * Plain-language advice for one cryptographic asset: what it's for, why it
 * matters and what to move to. Mirrors the migration table the engine uses
 * (src/server/engine/recommendations.ts) but phrased for people.
 */
import type { CryptoAsset } from "@/fixtures/types";
import { getRecommendation } from "@/server/engine/recommendations";
import type { NormalizedHit } from "@/server/engine/types";

const has = (s: string | undefined, re: RegExp) => !!s && re.test(s);

export function purposeOf(a: Pick<CryptoAsset, "primitive" | "kind" | "name">): string {
  const p = (a.primitive ?? "").toLowerCase();
  if (a.kind === "Certificate") return "Proves identity to other systems (a certificate).";
  if (a.kind === "Protocol") return "Protects data in transit (a protocol setting).";
  if (a.kind === "Library") return "A cryptography library the code depends on.";
  if (a.kind === "Secret") return "A secret or private key stored where it can be read.";
  if (p.includes("signature")) return "Signs data so others can check who sent it.";
  if (p.includes("key-agreement") || p.includes("kem") || p.includes("pke"))
    return "Agrees or exchanges keys between two parties.";
  if (p.includes("hash")) return "Makes a fingerprint of data (hashing).";
  if (p.includes("mac")) return "Checks data hasn't been tampered with (a MAC).";
  if (p.includes("cipher") || p.includes("ae")) return "Encrypts data so only key holders can read it.";
  if (a.kind === "Key") return "A key used to encrypt or sign data.";
  return "Used for cryptography in this code.";
}

export interface Advice {
  moveTo: string;
  standard?: string;
  why: string;
}

/** A suggested replacement, or null when the asset is already fine. */
export function adviceFor(
  a: Pick<CryptoAsset, "name" | "primitive" | "quantumSafe" | "crsfScore" | "keyLengthBits" | "kind">,
): Advice | null {
  const name = a.name.toUpperCase();
  const p = (a.primitive ?? "").toLowerCase();

  // Prefer the engine's own migration table so this matches the Recommendations page.
  const engine = getRecommendation({
    kind: a.kind.toUpperCase(),
    canonicalName: a.name,
    primitive: a.primitive,
    quantumSafe: a.quantumSafe,
  } as NormalizedHit);
  const why = whyFor(a, name, p);
  if (engine) return { moveTo: engine.toAlgorithm, standard: engine.standard, why: `${why} ${engine.notes}`.trim() };

  if (has(name, /\bMD5\b|SHA-?1\b/)) {
    return {
      moveTo: "SHA-256 or SHA-3",
      standard: "FIPS 180-4 / FIPS 202",
      why: "This hash is already broken on ordinary computers; collisions can be forged today.",
    };
  }
  if (has(name, /\b(3?DES|TRIPLE|RC4|BLOWFISH|RC2)\b/)) {
    return {
      moveTo: "AES-256-GCM",
      standard: "FIPS 197 / SP 800-38D",
      why: "This cipher is outdated and weak even without a quantum computer.",
    };
  }
  if (has(name, /AES-?128/)) {
    return {
      moveTo: "AES-256",
      standard: "FIPS 197",
      why: "Quantum search halves effective key strength, so 128-bit keys fall to about 64-bit strength.",
    };
  }
  if (a.kind === "Protocol" && has(name, /TLS ?1\.[01]|SSL/)) {
    return {
      moveTo: "TLS 1.3 with a hybrid ML-KEM key exchange",
      standard: "RFC 8446",
      why: "Old TLS versions have known attacks and no quantum-safe option.",
    };
  }
  if (a.quantumSafe === false || has(name, /\b(RSA|ECDSA|ECDH|DSA|DH|X25519|ED25519|P-?256|P-?384)\b/)) {
    if (p.includes("signature") || has(name, /ECDSA|DSA|ED25519/) || a.kind === "Certificate") {
      return {
        moveTo: "ML-DSA (Dilithium)",
        standard: "FIPS 204",
        why: "A quantum computer running Shor's algorithm can forge these signatures.",
      };
    }
    return {
      moveTo: "ML-KEM (Kyber), ideally in a hybrid with today's algorithm",
      standard: "FIPS 203",
      why: "A quantum computer can recover the key, and recorded traffic can be decrypted later.",
    };
  }
  if (a.crsfScore >= 45) {
    return {
      moveTo: "A current, approved algorithm",
      why: "The risk score is high because of how and where it's used, even if the algorithm itself is sound.",
    };
  }
  return null;
}

/** One sentence on why this kind of algorithm is a problem. */
function whyFor(a: Pick<CryptoAsset, "quantumSafe" | "kind">, name: string, p: string): string {
  if (/\bMD5\b|SHA-?1\b|\b(3?DES|RC4|BLOWFISH|RC2)\b/.test(name)) return "It's already weak on ordinary computers.";
  if (
    a.quantumSafe === false &&
    (p.includes("signature") || /ECDSA|DSA|ED25519/.test(name) || a.kind === "Certificate")
  )
    return "A quantum computer could forge these signatures.";
  if (a.quantumSafe === false)
    return "A quantum computer could recover the key, and traffic recorded today could be read later.";
  return "";
}

/** The single sentence at the top of an asset's drawer. */
export function inShort(a: CryptoAsset): string {
  if (a.quantumSafe) return `${a.name} is quantum-safe. Nothing to change here.`;
  if (a.crsfScore >= 70) return `${a.name} is high risk. It should be one of the first things you replace.`;
  if (a.crsfScore >= 45) return `${a.name} will need replacing. Plan the change soon.`;
  if (a.crsfScore >= 20) return `${a.name} isn't urgent, but it isn't quantum-safe. Schedule it with other upgrades.`;
  return `${a.name} is low risk today.`;
}
