/**
 * Secret detector family — PEM headers (handled by keys.ts), high-entropy
 * literals, 16/24/32-byte base64 assigned to key-shaped identifiers, and
 * cloud key formats. Gated on Shannon entropy to hold false positives down.
 */
import type { Rule, RawHit } from "../types";
import { iterMatches, lineNumberAt, snippet, shannonEntropy } from "./util";

type Emit = Omit<RawHit, "ruleId" | "pack">;

const ENTROPY_THRESHOLD = 4.0;
const KEY_SHAPED_IDENT = /(secret|token|api[_-]?key|password|passwd|pwd|private[_-]?key|access[_-]?key|client[_-]?secret)/i;

const CLOUD_KEY_PATTERNS: { name: string; regex: RegExp }[] = [
  { name: "AWS Access Key ID", regex: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: "AWS Secret Access Key (assignment)", regex: /aws_secret_access_key\s*=\s*['"]?([A-Za-z0-9/+=]{40})['"]?/gi },
  { name: "GitHub Personal Access Token", regex: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g },
  { name: "Slack Token", regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { name: "Google API Key", regex: /\bAIza[0-9A-Za-z\-_]{35}\b/g },
  { name: "Stripe Secret Key", regex: /\bsk_live_[0-9a-zA-Z]{24,}\b/g },
  { name: "Generic private key indicator", regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g },
];

function base64ByteLength(s: string): number {
  const padding = (s.match(/=+$/) ?? [""])[0].length;
  return Math.floor((s.length * 3) / 4) - padding;
}

export const secretRules: Rule[] = [
  {
    id: "secret.cloudKeyFormats",
    pack: "secrets",
    languages: ["*"],
    filePatterns: ["**/*"],
    match(content) {
      const hits: Emit[] = [];
      for (const { name, regex } of CLOUD_KEY_PATTERNS) {
        for (const m of iterMatches(regex, content)) {
          if (name.startsWith("Generic private key")) continue; // keys.ts owns full PEM parsing
          hits.push({
            kind: "SECRET",
            rawName: name,
            primitive: "secret",
            filePath: "",
            lineNumber: lineNumberAt(content, m.index),
            evidence: snippet(content, m.index, m[0].length),
            confidence: 0.9,
            severity: "CRITICAL",
            cweId: "CWE-798",
          });
        }
      }
      return hits;
    },
  },
  {
    id: "secret.highEntropyAssignment",
    pack: "secrets",
    languages: ["*"],
    filePatterns: [
      "**/*.js", "**/*.ts", "**/*.jsx", "**/*.tsx", "**/*.py", "**/*.java",
      "**/*.go", "**/*.c", "**/*.h", "**/*.cs", "**/*.rb", "**/*.env*",
      "**/*.yaml", "**/*.yml", "**/*.json", "**/*.tf",
    ],
    match(content) {
      const hits: Emit[] = [];
      // key_shaped_identifier = "literal" | 'literal' | literal (no quotes, env-style)
      const re = /([A-Za-z_][A-Za-z0-9_]*)\s*[:=]\s*["']?([A-Za-z0-9+/_.-]{20,})["']?/g;
      for (const m of iterMatches(re, content)) {
        const [, ident, value] = m;
        if (!KEY_SHAPED_IDENT.test(ident)) continue;
        if (/^\$\{|^process\.env|^os\.environ|^getenv/.test(value)) continue; // env indirection, not a literal
        const entropy = shannonEntropy(value);
        const byteLen = base64ByteLength(value);
        const keyShapedLength = [16, 24, 32].includes(byteLen);
        if (entropy < ENTROPY_THRESHOLD && !keyShapedLength) continue;

        hits.push({
          kind: "SECRET",
          rawName: `High-entropy literal assigned to "${ident}"`,
          primitive: "secret",
          keyLengthBits: keyShapedLength ? byteLen * 8 : undefined,
          filePath: "",
          lineNumber: lineNumberAt(content, m.index),
          evidence: `${ident} = <redacted, ${value.length} chars, entropy ${entropy.toFixed(2)}>`,
          confidence: keyShapedLength ? 0.75 : 0.55,
          severity: "HIGH",
          cweId: "CWE-798",
        });
      }
      return hits;
    },
  },
];
