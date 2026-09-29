/**
 * Key detector family — PKCS#1/#8 and OpenSSH keys via node-forge. Emits key
 * artefacts with algorithm, size, curve, and whether the private half is
 * committed to the repository (a finding in its own right).
 */
import forge from "node-forge";
import type { Rule, RawHit } from "../types";

type Emit = Omit<RawHit, "ruleId" | "pack">;

const PEM_KEY_HEADERS = [
  { header: "RSA PRIVATE KEY", kind: "private", algo: "RSA" },
  { header: "PRIVATE KEY", kind: "private", algo: "PKCS8" },
  { header: "ENCRYPTED PRIVATE KEY", kind: "private-encrypted", algo: "PKCS8" },
  { header: "EC PRIVATE KEY", kind: "private", algo: "EC" },
  { header: "DSA PRIVATE KEY", kind: "private", algo: "DSA" },
  { header: "OPENSSH PRIVATE KEY", kind: "private", algo: "OpenSSH" },
  { header: "PUBLIC KEY", kind: "public", algo: "PKCS8" },
  { header: "RSA PUBLIC KEY", kind: "public", algo: "RSA" },
];

function rsaBitsFromPem(pem: string): number | undefined {
  try {
    const key = forge.pki.privateKeyFromPem(pem) as unknown as { n?: { bitLength: () => number } };
    return key.n ? key.n.bitLength() : undefined;
  } catch {
    try {
      const pub = forge.pki.publicKeyFromPem(pem) as unknown as { n?: { bitLength: () => number } };
      return pub.n ? pub.n.bitLength() : undefined;
    } catch {
      return undefined;
    }
  }
}

export const keyRules: Rule[] = [
  {
    id: "key.pemBlock",
    pack: "keys",
    languages: ["*"],
    filePatterns: ["**/*.pem", "**/*.key", "**/*.pub", "**/id_rsa*", "**/id_dsa*", "**/id_ecdsa*", "**/id_ed25519*", "**/*.der"],
    match(content, filePath) {
      const hits: Emit[] = [];
      for (const { header, kind, algo } of PEM_KEY_HEADERS) {
        const re = new RegExp(`-----BEGIN ${header}-----[\\s\\S]+?-----END ${header}-----`, "g");
        let m: RegExpExecArray | null;
        while ((m = re.exec(content))) {
          const isPrivate = kind.startsWith("private");
          const bits = algo === "RSA" ? rsaBitsFromPem(m[0]) : undefined;
          hits.push({
            kind: "KEY",
            rawName: `${algo} ${isPrivate ? "private" : "public"} key${isPrivate && kind === "private" ? " (committed to repo)" : ""}`,
            primitive: "asymmetric-key",
            algorithm: algo,
            keyLengthBits: bits,
            filePath: "",
            evidence: `${header} block in ${filePath}`,
            confidence: 0.9,
            severity: isPrivate && kind === "private" ? "CRITICAL" : undefined,
            cweId: isPrivate && kind === "private" ? "CWE-321" : undefined,
          });
        }
      }

      // OpenSSH public key one-liner, e.g. "ssh-rsa AAAA... user@host"
      const sshPubRe = /^(ssh-rsa|ssh-ed25519|ecdsa-sha2-nistp256|ssh-dss)\s+([A-Za-z0-9+/=]+)/gm;
      let sm: RegExpExecArray | null;
      while ((sm = sshPubRe.exec(content))) {
        hits.push({
          kind: "KEY",
          rawName: `OpenSSH public key (${sm[1]})`,
          primitive: "asymmetric-key",
          algorithm: sm[1],
          filePath: "",
          evidence: sm[0].slice(0, 80),
          confidence: 0.7,
        });
      }

      return hits;
    },
  },
  {
    id: "key.hardcodedSymmetric",
    pack: "keys",
    languages: ["*"],
    filePatterns: ["**/*.c", "**/*.h", "**/*.java", "**/*.go", "**/*.py", "**/*.ts", "**/*.js", "**/*.cs"],
    match(content) {
      const hits: Emit[] = [];
      // C-style sized declaration, e.g. `uint8_t aes_key[16] = {0x2b, 0x7e, ...}`
      const cStyleRe = /(?:static\s+)?(?:const\s+)?(?:unsigned\s+char|uint8_t|byte\[\])\s+\w*key\w*\s*\[\s*(16|24|32)\s*\]\s*=\s*\{/gi;
      let m: RegExpExecArray | null;
      while ((m = cStyleRe.exec(content))) {
        const bits = Number(m[1]) * 8;
        hits.push({
          kind: "KEY",
          rawName: `Hardcoded symmetric key (${bits}-bit, committed to source)`,
          primitive: "symmetric-key",
          keyLengthBits: bits,
          filePath: "",
          evidence: content.slice(m.index, m.index + 80).replace(/\s+/g, " "),
          confidence: 0.7,
          severity: "CRITICAL",
          cweId: "CWE-321",
        });
      }

      // Java/JS/TS-style unsized array literal, e.g. `private static final byte[] KEY = { 0x8F, 0x2A, ... }`
      const literalRe = /(?:private\s+|public\s+|static\s+|final\s+|const\s+)*byte\[\]\s+\w*(?:KEY|SECRET)\w*\s*=\s*\{([^}]*)\}/gi;
      while ((m = literalRe.exec(content))) {
        const byteCount = m[1].split(",").map((s) => s.trim()).filter(Boolean).length;
        if (![8, 16, 24, 32].includes(byteCount)) continue;
        const bits = byteCount * 8;
        hits.push({
          kind: "KEY",
          rawName: `Hardcoded symmetric key (${bits}-bit, committed to source)`,
          primitive: "symmetric-key",
          keyLengthBits: bits,
          filePath: "",
          evidence: content.slice(m.index, m.index + 80).replace(/\s+/g, " "),
          confidence: 0.7,
          severity: "CRITICAL",
          cweId: "CWE-321",
        });
      }

      return hits;
    },
  },
];
