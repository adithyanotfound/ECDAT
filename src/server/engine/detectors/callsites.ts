/**
 * Call-site detector family — direct use of a crypto primitive in source code.
 * JS/TS `createCipheriv`, `createHash`, `subtle.*`, JWT `alg` · Java `Cipher.getInstance`,
 * `MessageDigest`, `SecureRandom("SHA1PRNG")` · Python `hashlib.md5`, `Crypto.Cipher.DES3`,
 * `ssl.PROTOCOL_*` · Go `crypto/*`, `tls.Config` · C `EVP_*`, `mbedtls_*` · C# `SHA1Managed`.
 * (IMPLEMENTATION_PLAN.md §4a)
 */
import type { Rule, RawHit } from "../types";
import { iterMatches, lineNumberAt, snippet, splitCipherMode, extractKeyLength } from "./util";

type Emit = Omit<RawHit, "ruleId" | "pack">;

function rule(
  id: string,
  languages: string[],
  filePatterns: string[],
  regex: RegExp,
  build: (m: RegExpExecArray, content: string) => Emit | null,
  cweId?: string,
  nistRef?: string
): Rule {
  return {
    id,
    pack: "callsites",
    languages,
    filePatterns,
    cweId,
    nistRef,
    match(content) {
      const hits: Emit[] = [];
      for (const m of iterMatches(regex, content)) {
        const built = build(m, content);
        if (built) hits.push(built);
      }
      return hits;
    },
  };
}

const JS_TS = ["**/*.js", "**/*.jsx", "**/*.ts", "**/*.tsx", "**/*.mjs", "**/*.cjs"];

export const callsiteRules: Rule[] = [
  // ── JavaScript / TypeScript ──────────────────────────────────────────────
  rule(
    "js.createCipheriv",
    ["javascript", "typescript"],
    JS_TS,
    /createCipheriv\(\s*["'`]([\w-]+)["'`]/g,
    (m, content) => {
      const { algo, mode } = splitCipherMode(m[1]);
      return {
        kind: "ALGORITHM",
        rawName: algo,
        mode,
        keyLengthBits: extractKeyLength(m[1]),
        filePath: "",
        lineNumber: lineNumberAt(content, m.index),
        evidence: snippet(content, m.index, m[0].length),
        confidence: 0.95,
      };
    },
    "CWE-327",
    "NIST SP 800-131A Rev 3"
  ),
  rule(
    "js.createHash",
    ["javascript", "typescript"],
    JS_TS,
    /createHash\(\s*["'`]([\w-]+)["'`]/g,
    (m, content) => ({
      kind: "ALGORITHM",
      rawName: m[1],
      primitive: "hash",
      filePath: "",
      lineNumber: lineNumberAt(content, m.index),
      evidence: snippet(content, m.index, m[0].length),
      confidence: 0.95,
    }),
    "CWE-327",
    "NIST SP 800-131A Rev 3"
  ),
  rule(
    "js.subtleDigest",
    ["javascript", "typescript"],
    JS_TS,
    /subtle\.digest\(\s*["'`]?([\w-]+)["'`]?/g,
    (m, content) => ({
      kind: "ALGORITHM",
      rawName: m[1],
      primitive: "hash",
      executionEnvironment: "webcrypto",
      filePath: "",
      lineNumber: lineNumberAt(content, m.index),
      evidence: snippet(content, m.index, m[0].length),
      confidence: 0.85,
    })
  ),
  rule(
    "js.subtleKeyAlgo",
    ["javascript", "typescript"],
    JS_TS,
    /subtle\.(?:generateKey|importKey|deriveKey|deriveBits|sign|verify)\([^)]*name:\s*["'`]([\w-]+)["'`]/g,
    (m, content) => ({
      kind: "ALGORITHM",
      rawName: m[1],
      executionEnvironment: "webcrypto",
      filePath: "",
      lineNumber: lineNumberAt(content, m.index),
      evidence: snippet(content, m.index, m[0].length),
      confidence: 0.8,
    })
  ),
  rule(
    "js.jwtAlg",
    ["javascript", "typescript"],
    JS_TS,
    /\balg(?:orithm)?\s*:\s*["'`](HS256|HS384|HS512|RS256|RS384|RS512|PS256|ES256|ES384|none)["'`]/g,
    (m, content) => {
      const alg = m[1];
      if (alg.toLowerCase() === "none") {
        return {
          kind: "ALGORITHM",
          rawName: "JWT alg=none",
          primitive: "signature",
          keyLengthBits: 0,
          quantumSafe: false,
          nistQuantumLevel: 0,
          classicalSecLevel: 0,
          filePath: "",
          lineNumber: lineNumberAt(content, m.index),
          evidence: snippet(content, m.index, m[0].length),
          confidence: 0.9,
          severity: "CRITICAL",
          cweId: "CWE-347",
        };
      }
      return {
        kind: "ALGORITHM",
        rawName: alg,
        filePath: "",
        lineNumber: lineNumberAt(content, m.index),
        evidence: snippet(content, m.index, m[0].length),
        confidence: 0.85,
      };
    },
    "CWE-347"
  ),
  rule(
    "js.createSign",
    ["javascript", "typescript"],
    JS_TS,
    /create(?:Sign|Verify)\(\s*["'`]([\w-]+)["'`]/g,
    (m, content) => ({
      kind: "ALGORITHM",
      rawName: m[1],
      primitive: "signature",
      filePath: "",
      lineNumber: lineNumberAt(content, m.index),
      evidence: snippet(content, m.index, m[0].length),
      confidence: 0.85,
    })
  ),
  rule(
    "js.md5npm",
    ["javascript", "typescript"],
    JS_TS,
    /\brequire\(\s*["'`]md5["'`]\s*\)|from\s+["'`]md5["'`]/g,
    (m, content) => ({
      kind: "ALGORITHM",
      rawName: "MD5",
      primitive: "hash",
      filePath: "",
      lineNumber: lineNumberAt(content, m.index),
      evidence: snippet(content, m.index, m[0].length),
      confidence: 0.8,
    })
  ),

  // ── Java ──────────────────────────────────────────────────────────────────
  rule(
    "java.cipherGetInstance",
    ["java"],
    ["**/*.java"],
    /Cipher\.getInstance\(\s*"([^"]+)"/g,
    (m, content) => {
      const [algo, mode, padding] = m[1].split("/");
      return {
        kind: "ALGORITHM",
        rawName: algo,
        mode,
        padding,
        filePath: "",
        lineNumber: lineNumberAt(content, m.index),
        evidence: snippet(content, m.index, m[0].length),
        confidence: 0.95,
      };
    },
    "CWE-327",
    "NIST SP 800-131A Rev 3"
  ),
  rule(
    "java.messageDigest",
    ["java"],
    ["**/*.java"],
    /MessageDigest\.getInstance\(\s*"([^"]+)"/g,
    (m, content) => ({
      kind: "ALGORITHM",
      rawName: m[1],
      primitive: "hash",
      filePath: "",
      lineNumber: lineNumberAt(content, m.index),
      evidence: snippet(content, m.index, m[0].length),
      confidence: 0.95,
    }),
    "CWE-327"
  ),
  rule(
    "java.secureRandom",
    ["java"],
    ["**/*.java"],
    /SecureRandom(?:\.getInstance)?\(\s*"([^"]+)"/g,
    (m, content) => ({
      kind: "ALGORITHM",
      rawName: `SecureRandom(${m[1]})`,
      primitive: "random",
      quantumSafe: !/SHA1PRNG/i.test(m[1]),
      classicalSecLevel: /SHA1PRNG/i.test(m[1]) ? 80 : 128,
      filePath: "",
      lineNumber: lineNumberAt(content, m.index),
      evidence: snippet(content, m.index, m[0].length),
      confidence: 0.9,
      severity: /SHA1PRNG/i.test(m[1]) ? "HIGH" : undefined,
      cweId: "CWE-338",
    })
  ),
  rule(
    "java.mac",
    ["java"],
    ["**/*.java"],
    /Mac\.getInstance\(\s*"([^"]+)"/g,
    (m, content) => ({
      kind: "ALGORITHM",
      rawName: m[1],
      primitive: "mac",
      filePath: "",
      lineNumber: lineNumberAt(content, m.index),
      evidence: snippet(content, m.index, m[0].length),
      confidence: 0.9,
    })
  ),
  rule(
    "java.keyPairGenerator",
    ["java"],
    ["**/*.java"],
    /KeyPairGenerator\.getInstance\(\s*"(RSA|EC|DSA|DiffieHellman)"\s*\)/g,
    (m, content) => {
      const nearby = content.slice(m.index, m.index + 300);
      const keyLenMatch = nearby.match(/initialize\(\s*(\d+)/);
      const rawName = m[1] === "RSA" ? "RSA" : m[1] === "EC" ? "ECDSA-P256" : m[1];
      return {
        kind: "ALGORITHM",
        rawName,
        primitive: "signature",
        keyLengthBits: keyLenMatch ? Number(keyLenMatch[1]) : undefined,
        filePath: "",
        lineNumber: lineNumberAt(content, m.index),
        evidence: snippet(content, m.index, m[0].length),
        confidence: 0.75,
      };
    }
  ),

  // ── Python ────────────────────────────────────────────────────────────────
  rule(
    "py.hashlib",
    ["python"],
    ["**/*.py"],
    /hashlib\.(md5|sha1|sha224|sha256|sha384|sha512|sha3_256|sha3_512)\s*\(/g,
    (m, content) => ({
      kind: "ALGORITHM",
      rawName: m[1].replace("_", "-"),
      primitive: "hash",
      filePath: "",
      lineNumber: lineNumberAt(content, m.index),
      evidence: snippet(content, m.index, m[0].length),
      confidence: 0.95,
    }),
    "CWE-327"
  ),
  rule(
    "py.pycryptodomeCipher",
    ["python"],
    ["**/*.py"],
    /Crypto\.Cipher\.(DES3|DES|ARC4|Blowfish|AES)\b|from\s+Crypto\.Cipher\s+import\s+([^\n]+)/g,
    (m, content) => {
      const rawName = m[1] ?? m[2]?.split(/[,\s]+/).find(Boolean)?.trim();
      if (!rawName) return null;
      return {
        kind: "ALGORITHM",
        rawName,
        filePath: "",
        lineNumber: lineNumberAt(content, m.index),
        evidence: snippet(content, m.index, m[0].length),
        confidence: 0.85,
      };
    },
    "CWE-327"
  ),
  rule(
    "py.sslProtocol",
    ["python"],
    ["**/*.py"],
    /ssl\.PROTOCOL_(SSLv2|SSLv3|TLSv1|TLSv1_1|TLSv1_2|TLSv1_3)/g,
    (m, content) => {
      const ver = m[1].replace("_", ".").replace("TLSv1.", "TLS 1.").replace("SSLv", "SSL ");
      const weak = /SSLv|TLSv1$|TLSv1_1/.test(m[1]);
      return {
        kind: "PROTOCOL",
        rawName: `TLS Protocol (${ver})`,
        primitive: "protocol",
        // Protocol *version* isn't itself PQC-relevant — only flag unsafe for
        // genuinely deprecated versions; a compliant TLS 1.2/1.3 pin leaves
        // quantum posture unset rather than dragging down the PQC average.
        quantumSafe: weak ? false : undefined,
        filePath: "",
        lineNumber: lineNumberAt(content, m.index),
        evidence: snippet(content, m.index, m[0].length),
        confidence: 0.9,
        severity: weak ? "CRITICAL" : undefined,
        cweId: weak ? "CWE-326" : undefined,
      };
    }
  ),
  rule(
    "py.sslVerifyDisabled",
    ["python"],
    ["**/*.py"],
    /verify\s*=\s*False/g,
    (m, content) => ({
      kind: "PROTOCOL",
      rawName: "TLS certificate verification disabled",
      primitive: "protocol",
      quantumSafe: false,
      filePath: "",
      lineNumber: lineNumberAt(content, m.index),
      evidence: snippet(content, m.index, m[0].length),
      confidence: 0.75,
      severity: "CRITICAL",
      cweId: "CWE-295",
    })
  ),
  rule(
    "py.paramikoAutoAddPolicy",
    ["python"],
    ["**/*.py"],
    /AutoAddPolicy\s*\(\s*\)/g,
    (m, content) => ({
      kind: "PROTOCOL",
      rawName: "SSH host key verification disabled (Paramiko AutoAddPolicy)",
      primitive: "protocol",
      quantumSafe: false,
      filePath: "",
      lineNumber: lineNumberAt(content, m.index),
      evidence: snippet(content, m.index, m[0].length),
      confidence: 0.85,
      severity: "HIGH",
      cweId: "CWE-322",
    })
  ),
  rule(
    "py.fernet",
    ["python"],
    ["**/*.py"],
    /from\s+cryptography\.fernet\s+import\s+Fernet|Fernet\.generate_key\(\)/g,
    (m, content) => ({
      kind: "ALGORITHM",
      rawName: "Fernet",
      filePath: "",
      lineNumber: lineNumberAt(content, m.index),
      evidence: snippet(content, m.index, m[0].length),
      confidence: 0.8,
    })
  ),

  // ── Go ────────────────────────────────────────────────────────────────────
  rule(
    "go.cryptoImport",
    ["go"],
    ["**/*.go"],
    /"crypto\/(des|rc4|md5|sha1|sha256|sha512|aes|rsa|ecdsa|ed25519)"/g,
    (m, content) => {
      const pkg = m[1];
      let rawName: string =
        {
          des: "DES", rc4: "RC4", md5: "MD5", sha1: "SHA-1", sha256: "SHA-256",
          sha512: "SHA-512", aes: "AES-128", rsa: "RSA-2048", ecdsa: "ECDSA-P256", ed25519: "Ed25519",
        }[pkg] ?? pkg;

      // `crypto/aes` doesn't name a key size on its own — infer it from a
      // `[16|24|32]byte` key declaration elsewhere in the file rather than
      // defaulting every AES usage to the weakest variant.
      if (pkg === "aes") {
        const sizeHint = content.match(/\[(16|24|32)\]byte/);
        if (sizeHint) rawName = `AES-${Number(sizeHint[1]) * 8}`;
      }

      return {
        kind: "ALGORITHM",
        rawName,
        filePath: "",
        lineNumber: lineNumberAt(content, m.index),
        evidence: snippet(content, m.index, m[0].length),
        confidence: 0.7,
      };
    }
  ),
  rule(
    "go.tlsMinVersion",
    ["go"],
    ["**/*.go"],
    /MinVersion:\s*tls\.(VersionSSL30|VersionTLS10|VersionTLS11|VersionTLS12|VersionTLS13)/g,
    (m, content) => {
      const weak = /SSL30|TLS10|TLS11/.test(m[1]);
      return {
        kind: "PROTOCOL",
        rawName: `TLS MinVersion (${m[1].replace("Version", "")})`,
        primitive: "protocol",
        quantumSafe: weak ? false : undefined,
        filePath: "",
        lineNumber: lineNumberAt(content, m.index),
        evidence: snippet(content, m.index, m[0].length),
        confidence: 0.9,
        severity: weak ? "HIGH" : undefined,
        cweId: weak ? "CWE-326" : undefined,
      };
    }
  ),
  rule(
    "go.x25519mlkem768",
    ["go"],
    ["**/*.go"],
    /X25519MLKEM768/g,
    (m, content) => ({
      kind: "ALGORITHM",
      rawName: "X25519MLKEM768",
      filePath: "",
      lineNumber: lineNumberAt(content, m.index),
      evidence: snippet(content, m.index, m[0].length),
      confidence: 0.95,
    })
  ),
  rule(
    "go.circlMlkem",
    ["go"],
    ["**/*.go"],
    /cloudflare\/circl\/kem\/(mlkem768|kyber768|mlkem1024)/g,
    (m, content) => ({
      kind: "ALGORITHM",
      rawName: m[1] === "mlkem1024" ? "ML-KEM-1024" : "ML-KEM-768",
      filePath: "",
      lineNumber: lineNumberAt(content, m.index),
      evidence: snippet(content, m.index, m[0].length),
      confidence: 0.9,
    })
  ),
  rule(
    "go.circlSign",
    ["go"],
    ["**/*.go"],
    /cloudflare\/circl\/sign\/(dilithium|ed25519)/g,
    (m, content) => ({
      kind: "ALGORITHM",
      rawName: m[1] === "dilithium" ? "ML-DSA-65" : "Ed25519",
      filePath: "",
      lineNumber: lineNumberAt(content, m.index),
      evidence: snippet(content, m.index, m[0].length),
      confidence: 0.9,
    })
  ),

  // ── C ─────────────────────────────────────────────────────────────────────
  rule(
    "c.evpCipher",
    ["c", "cpp"],
    ["**/*.c", "**/*.h", "**/*.cpp", "**/*.hpp", "**/*.cc"],
    /EVP_(des_ede3_cbc|des_cbc|rc4|aes_128_cbc|aes_128_gcm|aes_256_cbc|aes_256_gcm|aes_192_cbc|bf_cbc)\s*\(/g,
    (m, content) => {
      const raw = m[1].replace(/_/g, "-");
      const { algo, mode } = splitCipherMode(raw);
      return {
        kind: "ALGORITHM",
        rawName: algo,
        mode,
        keyLengthBits: extractKeyLength(raw),
        filePath: "",
        lineNumber: lineNumberAt(content, m.index),
        evidence: snippet(content, m.index, m[0].length),
        confidence: 0.9,
      };
    },
    "CWE-327"
  ),
  rule(
    "c.evpDigest",
    ["c", "cpp"],
    ["**/*.c", "**/*.h", "**/*.cpp", "**/*.hpp", "**/*.cc"],
    /EVP_(md5|sha1|sha224|sha256|sha384|sha512)\s*\(/g,
    (m, content) => ({
      kind: "ALGORITHM",
      rawName: m[1],
      primitive: "hash",
      filePath: "",
      lineNumber: lineNumberAt(content, m.index),
      evidence: snippet(content, m.index, m[0].length),
      confidence: 0.9,
    }),
    "CWE-327"
  ),
  rule(
    "c.mbedtlsSslMinor",
    ["c"],
    ["**/*.c", "**/*.h"],
    /MBEDTLS_SSL_MINOR_VERSION_(\d)/g,
    (m, content) => {
      const minor = Number(m[1]);
      const names = ["SSL 3.0", "TLS 1.0", "TLS 1.1", "TLS 1.2", "TLS 1.3"];
      const weak = minor <= 2;
      return {
        kind: "PROTOCOL",
        rawName: `TLS Protocol Floor (${names[minor] ?? m[1]})`,
        primitive: "protocol",
        quantumSafe: weak ? false : undefined,
        filePath: "",
        lineNumber: lineNumberAt(content, m.index),
        evidence: snippet(content, m.index, m[0].length),
        confidence: 0.9,
        severity: weak ? "CRITICAL" : undefined,
        cweId: weak ? "CWE-326" : undefined,
      };
    }
  ),
  rule(
    "c.mbedtlsDigest",
    ["c"],
    ["**/*.c", "**/*.h"],
    /mbedtls_(md5|sha1|sha256|sha512)(?:_ret)?\s*\(/g,
    (m, content) => ({
      kind: "ALGORITHM",
      rawName: m[1],
      primitive: "hash",
      filePath: "",
      lineNumber: lineNumberAt(content, m.index),
      evidence: snippet(content, m.index, m[0].length),
      confidence: 0.85,
    }),
    "CWE-327"
  ),
  rule(
    "c.mbedtlsCipher",
    ["c"],
    ["**/*.c", "**/*.h"],
    /mbedtls_(des|aes)_(?:setkey_enc|setkey_dec|crypt_ecb|crypt_cbc)\s*\(/g,
    (m, content) => ({
      kind: "ALGORITHM",
      rawName: m[1] === "des" ? "DES" : "AES-128",
      filePath: "",
      lineNumber: lineNumberAt(content, m.index),
      evidence: snippet(content, m.index, m[0].length),
      confidence: 0.85,
    })
  ),
  rule(
    "c.xorObfuscation",
    ["c"],
    ["**/*.c", "**/*.h"],
    /\b(xor_obfuscate|xor_encrypt|xor_decrypt|obfuscate_key)\s*\(/g,
    (m, content) => ({
      kind: "ALGORITHM",
      rawName: "XOR-Obfuscation",
      filePath: "",
      lineNumber: lineNumberAt(content, m.index),
      evidence: snippet(content, m.index, m[0].length),
      confidence: 0.7,
      severity: "CRITICAL",
      cweId: "CWE-327",
    })
  ),

  // ── C# ────────────────────────────────────────────────────────────────────
  rule(
    "cs.sha1managed",
    ["csharp"],
    ["**/*.cs"],
    /new\s+SHA1(?:Managed|CryptoServiceProvider)?\s*\(/g,
    (m, content) => ({
      kind: "ALGORITHM",
      rawName: "SHA-1",
      primitive: "hash",
      filePath: "",
      lineNumber: lineNumberAt(content, m.index),
      evidence: snippet(content, m.index, m[0].length),
      confidence: 0.9,
    }),
    "CWE-327"
  ),
  rule(
    "cs.md5",
    ["csharp"],
    ["**/*.cs"],
    /new\s+MD5CryptoServiceProvider\s*\(/g,
    (m, content) => ({
      kind: "ALGORITHM",
      rawName: "MD5",
      primitive: "hash",
      filePath: "",
      lineNumber: lineNumberAt(content, m.index),
      evidence: snippet(content, m.index, m[0].length),
      confidence: 0.9,
    }),
    "CWE-327"
  ),
  rule(
    "cs.desTripleDes",
    ["csharp"],
    ["**/*.cs"],
    /new\s+(DES|TripleDES)CryptoServiceProvider\s*\(/g,
    (m, content) => ({
      kind: "ALGORITHM",
      rawName: m[1] === "TripleDES" ? "3DES" : "DES",
      filePath: "",
      lineNumber: lineNumberAt(content, m.index),
      evidence: snippet(content, m.index, m[0].length),
      confidence: 0.9,
    }),
    "CWE-327"
  ),
];
