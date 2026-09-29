/**
 * Protocol-config detector family — nginx ssl_protocols/ssl_ciphers, Apache
 * SSLCipherSuite, sshd_config KexAlgorithms/Ciphers/MACs, openssl.cnf,
 * Terraform ssl_policy/aws_kms_key, k8s TLS secrets. The source of the
 * reference report's Strong/Weak KEX, Cipher and MAC summary.
 */
import type { Rule, RawHit } from "../types";
import { lineNumberAt, snippet } from "./util";

type Emit = Omit<RawHit, "ruleId" | "pack">;

const WEAK_TLS = new Set(["SSLv2", "SSLv3", "TLSv1", "TLSv1.0", "TLSv1.1"]);
const WEAK_KEX = [/diffie-hellman-group1-sha1/i, /diffie-hellman-group14-sha1/i, /gss-group1-sha1/i];
const WEAK_CIPHERS = [/3des-cbc/i, /\barcfour\b/i, /\bdes-cbc\b/i, /rc4/i, /\bnull\b/i];
const WEAK_MACS = [/hmac-md5/i, /hmac-sha1-96/i, /\bumac-64\b/i];

function severityFor(weak: boolean): RawHit["severity"] {
  return weak ? "HIGH" : undefined;
}

export const protocolRules: Rule[] = [
  {
    id: "protocol.nginxSslProtocols",
    pack: "protocols",
    languages: ["nginx"],
    filePatterns: ["**/nginx.conf", "**/*.nginx.conf", "**/sites-*/**", "**/conf.d/**/*.conf"],
    match(content) {
      const hits: Emit[] = [];
      const re = /ssl_protocols\s+([^;]+);/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(content))) {
        const versions = m[1].trim().split(/\s+/);
        const weak = versions.some((v) => WEAK_TLS.has(v));
        hits.push({
          kind: "PROTOCOL",
          rawName: `nginx ssl_protocols (${versions.join(", ")})`,
          primitive: "protocol",
          quantumSafe: weak ? false : undefined,
          filePath: "",
          lineNumber: lineNumberAt(content, m.index),
          evidence: snippet(content, m.index, m[0].length),
          confidence: 0.9,
          severity: severityFor(weak),
          cweId: weak ? "CWE-326" : undefined,
        });
      }
      const cipherRe = /ssl_ciphers\s+["']?([^;"']+)["']?;/g;
      while ((m = cipherRe.exec(content))) {
        const weak = /3DES|RC4|MD5|NULL|EXPORT/i.test(m[1]);
        hits.push({
          kind: "PROTOCOL",
          rawName: `nginx ssl_ciphers`,
          primitive: "cipher-suite",
          filePath: "",
          lineNumber: lineNumberAt(content, m.index),
          evidence: snippet(content, m.index, m[0].length),
          confidence: 0.85,
          severity: severityFor(weak),
          cweId: weak ? "CWE-327" : undefined,
        });
      }
      return hits;
    },
  },
  {
    id: "protocol.apacheSslCipherSuite",
    pack: "protocols",
    languages: ["apache"],
    filePatterns: ["**/httpd.conf", "**/apache2.conf", "**/*.apache.conf", "**/sites-available/**"],
    match(content) {
      const hits: Emit[] = [];
      const re = /SSLCipherSuite\s+([^\n]+)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(content))) {
        const weak = /3DES|RC4|MD5|NULL|EXPORT/i.test(m[1]);
        hits.push({
          kind: "PROTOCOL",
          rawName: "Apache SSLCipherSuite",
          primitive: "cipher-suite",
          filePath: "",
          lineNumber: lineNumberAt(content, m.index),
          evidence: snippet(content, m.index, m[0].length),
          confidence: 0.85,
          severity: severityFor(weak),
          cweId: weak ? "CWE-327" : undefined,
        });
      }
      return hits;
    },
  },
  {
    id: "protocol.sshdConfig",
    pack: "protocols",
    languages: ["ssh"],
    filePatterns: ["**/sshd_config", "**/ssh_config"],
    match(content) {
      const hits: Emit[] = [];
      for (const [directive, weakList, label] of [
        ["KexAlgorithms", WEAK_KEX, "KEX"],
        ["Ciphers", WEAK_CIPHERS, "Cipher"],
        ["MACs", WEAK_MACS, "MAC"],
      ] as const) {
        const re = new RegExp(`^${directive}\\s+([^\\n]+)`, "gm");
        let m: RegExpExecArray | null;
        while ((m = re.exec(content))) {
          const weak = weakList.some((re2) => re2.test(m![1]));
          hits.push({
            kind: "PROTOCOL",
            rawName: `sshd_config ${directive} (${label})`,
            primitive: "cipher-suite",
            filePath: "",
            lineNumber: lineNumberAt(content, m.index),
            evidence: snippet(content, m.index, m[0].length),
            confidence: 0.9,
            severity: severityFor(weak),
            cweId: weak ? "CWE-327" : undefined,
          });
        }
      }
      return hits;
    },
  },
  {
    id: "protocol.opensslCnf",
    pack: "protocols",
    languages: ["openssl"],
    filePatterns: ["**/openssl.cnf", "**/openssl.conf"],
    match(content) {
      const hits: Emit[] = [];
      const re = /MinProtocol\s*=\s*(\S+)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(content))) {
        const weak = WEAK_TLS.has(m[1]);
        hits.push({
          kind: "PROTOCOL",
          rawName: `openssl.cnf MinProtocol (${m[1]})`,
          primitive: "protocol",
          filePath: "",
          lineNumber: lineNumberAt(content, m.index),
          evidence: snippet(content, m.index, m[0].length),
          confidence: 0.85,
          severity: severityFor(weak),
          cweId: weak ? "CWE-326" : undefined,
        });
      }
      return hits;
    },
  },
  {
    id: "protocol.terraformTls",
    pack: "protocols",
    languages: ["terraform"],
    filePatterns: ["**/*.tf"],
    match(content) {
      const hits: Emit[] = [];
      const policyRe = /ssl_policy\s*=\s*"([^"]+)"/g;
      let m: RegExpExecArray | null;
      while ((m = policyRe.exec(content))) {
        const weak = /2015|2016|TLS-1-0|TLS-1-1/i.test(m[1]);
        hits.push({
          kind: "PROTOCOL",
          rawName: `Terraform ssl_policy (${m[1]})`,
          primitive: "protocol",
          filePath: "",
          lineNumber: lineNumberAt(content, m.index),
          evidence: snippet(content, m.index, m[0].length),
          confidence: 0.85,
          severity: severityFor(weak),
          cweId: weak ? "CWE-326" : undefined,
        });
      }
      const kmsRe = /resource\s+"aws_kms_key"\s+"([^"]+)"/g;
      while ((m = kmsRe.exec(content))) {
        hits.push({
          kind: "KEY",
          rawName: `AWS KMS key (${m[1]})`,
          primitive: "managed-key",
          filePath: "",
          lineNumber: lineNumberAt(content, m.index),
          evidence: snippet(content, m.index, m[0].length),
          confidence: 0.8,
        });
      }
      return hits;
    },
  },
  {
    id: "protocol.k8sTlsSecret",
    pack: "protocols",
    languages: ["yaml"],
    filePatterns: ["**/*.yaml", "**/*.yml"],
    match(content) {
      const hits: Emit[] = [];
      if (/type:\s*kubernetes\.io\/tls/.test(content)) {
        const idx = content.indexOf("kubernetes.io/tls");
        hits.push({
          kind: "CERTIFICATE",
          rawName: "Kubernetes TLS secret",
          primitive: "certificate",
          filePath: "",
          lineNumber: lineNumberAt(content, idx),
          evidence: snippet(content, idx, 18),
          confidence: 0.8,
        });
      }
      return hits;
    },
  },
];
