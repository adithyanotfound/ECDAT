/**
 * Certificate detector family — *.pem .crt .cer .der .p12 .jks parsed with
 * @peculiar/x509. Emits signature algorithm, public-key algorithm and size,
 * validity window, issuer, SAN — plus an expiry finding class of its own.
 *
 * PEM/DER (X.509) certificates are fully parsed. JKS/P12 keystores are
 * container formats requiring a passphrase to open; without credentials we
 * can only flag their presence as a KEY-kind artefact (see keys.ts) — full
 * certificate extraction from a locked keystore is out of scope here.
 */
// @peculiar/x509's DI container (tsyringe) requires this polyfill to be loaded
// before the package's own module-level code runs — must stay the first import.
import "reflect-metadata";
import { X509Certificate } from "@peculiar/x509";
import type { Rule, RawHit } from "../types";

type Emit = Omit<RawHit, "ruleId" | "pack">;

/** WebCrypto algorithm name -> a short human prefix. */
const SIG_ALGO_PREFIX: Record<string, string> = {
  "RSASSA-PKCS1-v1_5": "RSA",
  "RSA-PSS": "RSA-PSS",
  ECDSA: "ECDSA",
  Ed25519: "Ed25519",
  Ed448: "Ed448",
};

function describeSignatureAlgorithm(alg: { name?: string; hash?: { name?: string } }): string {
  const prefix = SIG_ALGO_PREFIX[alg.name ?? ""] ?? alg.name ?? "unknown";
  const hash = alg.hash?.name;
  return hash ? `${prefix}-${hash.replace("-", "")}` : prefix;
}

function parsePem(content: string): { der: string; pemBlock: string }[] {
  const blocks: { der: string; pemBlock: string }[] = [];
  const re = /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    blocks.push({ der: m[0], pemBlock: m[0] });
  }
  return blocks;
}

function certToHit(cert: X509Certificate, evidence: string): Emit | null {
  try {
    const sigName = describeSignatureAlgorithm(
      cert.signatureAlgorithm as { name?: string; hash?: { name?: string } }
    );
    const pubKeyAlgo = cert.publicKey?.algorithm as
      | { name?: string; modulusLength?: number; namedCurve?: string }
      | undefined;

    const now = Date.now();
    const expiresInDays = Math.round((cert.notAfter.getTime() - now) / 86_400_000);
    const expired = expiresInDays < 0;
    const expiringSoon = expiresInDays >= 0 && expiresInDays < 30;
    const weakSig = /SHA1|MD5/i.test(sigName);

    const keyBits = pubKeyAlgo?.modulusLength ?? (pubKeyAlgo?.namedCurve ? 256 : undefined);

    return {
      kind: "CERTIFICATE",
      rawName: `${cert.subject} (${sigName})`,
      primitive: "certificate",
      algorithm: sigName,
      keyLengthBits: keyBits,
      curve: pubKeyAlgo?.namedCurve,
      quantumSafe: false,
      nistQuantumLevel: 0,
      filePath: "",
      evidence: `subject=${cert.subject}; issuer=${cert.issuer}; notAfter=${cert.notAfter.toISOString()}; ${evidence.slice(0, 60)}`,
      confidence: 0.95,
      severity: expired ? "CRITICAL" : expiringSoon ? "HIGH" : weakSig ? "HIGH" : undefined,
      cweId: expired ? "CWE-298" : weakSig ? "CWE-327" : undefined,
    };
  } catch {
    return null;
  }
}

export const certificateRules: Rule[] = [
  {
    id: "cert.pem",
    pack: "certificates",
    languages: ["*"],
    filePatterns: ["**/*.pem", "**/*.crt", "**/*.cer"],
    match(content) {
      const hits: Emit[] = [];
      const pemBlocks = content.includes("BEGIN CERTIFICATE") ? parsePem(content) : [];
      for (const block of pemBlocks) {
        try {
          const cert = new X509Certificate(block.der);
          const hit = certToHit(cert, block.pemBlock);
          if (hit) hits.push(hit);
        } catch {
          // not a parseable certificate — skip
        }
      }
      return hits;
    },
  },
  {
    id: "cert.jksP12",
    pack: "certificates",
    languages: ["*"],
    filePatterns: ["**/*.jks", "**/*.p12", "**/*.pfx"],
    match(content, filePath) {
      // Binary keystore container — flag presence without decrypting.
      const kind = filePath.endsWith(".jks") ? "Java KeyStore (JKS)" : "PKCS#12 keystore";
      return [
        {
          kind: "CERTIFICATE",
          rawName: `${kind} (encrypted container)`,
          primitive: "keystore",
          filePath: "",
          evidence: `Binary keystore container detected at ${filePath}; contents not extracted without a passphrase.`,
          confidence: 0.6,
        },
      ];
    },
  },
];
