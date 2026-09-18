/**
 * Configuration/protocol scanning engine — Phase 5, Step 8.
 *
 * Pure file discovery + directive parsing + fingerprinting: no Prisma/
 * database dependency, mirroring js-crypto-scan.ts / certkey-scan.ts /
 * manifest-scan.ts exactly. config-protocol-detector.ts layers persistence
 * on top.
 *
 * Scope: nginx `ssl_protocols`/`ssl_ciphers`, sshd_config-style
 * `Ciphers`/`MACs`/`KexAlgorithms`, and a narrow slice of Terraform
 * TLS-version configuration (`minimum_tls_version`, `min_tls_version`,
 * `ssl_policy`). Every directive is parsed as a single line — a directive
 * split across multiple lines (nginx's `\`-continuation, HCL heredocs) is
 * not supported; documented limitation, not a silent gap.
 *
 * Only emits a detection when a directive is actually matched and yields at
 * least one non-empty configured value — a file being named `nginx.conf` or
 * `*.tf` is never itself a detection.
 */
import { readFile, stat } from "node:fs/promises";
import { createHash as sha256 } from "node:crypto";
import path from "node:path";
import fg from "fast-glob";

import { IGNORED_DIR_GLOBS, DETECTOR_MAX_FILE_BYTES, type DetectorLogger } from "./js-crypto-scan";
import type { NormalizedCryptoUsage } from "./types";

// ─── File discovery ─────────────────────────────────────────────────────────

const NGINX_GLOBS = ["**/nginx.conf", "**/*.conf", "**/sites-available/**", "**/sites-enabled/**", "**/conf.d/**"];
const SSH_GLOBS = ["**/sshd_config", "**/ssh_config", "**/sshd_config.d/**/*", "**/ssh_config.d/**/*"];
const TERRAFORM_GLOBS = ["**/*.tf"];

const ALL_GLOBS = [...NGINX_GLOBS, ...SSH_GLOBS, ...TERRAFORM_GLOBS];

export async function discoverConfigProtocolFiles(dir: string): Promise<string[]> {
  const entries = await fg(ALL_GLOBS, {
    cwd: dir,
    ignore: IGNORED_DIR_GLOBS,
    onlyFiles: true,
    dot: false,
    followSymbolicLinks: false,
    unique: true,
    suppressErrors: true,
  });
  return entries.sort();
}

/** Reads one config file, enforcing the shared per-file size cap and repo-root containment. Never throws. */
export async function readConfigFile(dir: string, relPath: string, onLog: DetectorLogger): Promise<string | null> {
  const resolvedRoot = path.resolve(dir);
  const absPath = path.resolve(resolvedRoot, relPath);

  if (absPath !== resolvedRoot && !absPath.startsWith(resolvedRoot + path.sep)) {
    await onLog("WARN", `[config-protocol] skipped file escaping repository root: ${relPath}`);
    return null;
  }

  let size: number;
  try {
    size = (await stat(absPath)).size;
  } catch {
    return null;
  }

  if (size > DETECTOR_MAX_FILE_BYTES) {
    await onLog("WARN", `[config-protocol] skipped ${relPath} (${size} bytes) — exceeds ${DETECTOR_MAX_FILE_BYTES}-byte limit`);
    return null;
  }

  try {
    return await readFile(absPath, "utf8");
  } catch (err) {
    await onLog("WARN", `[config-protocol] failed to read ${relPath}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

// ─── Rule IDs ───────────────────────────────────────────────────────────────

export const RULE_NGINX_SSL_PROTOCOLS = "config.nginx.ssl_protocols";
export const RULE_NGINX_SSL_CIPHERS = "config.nginx.ssl_ciphers";
export const RULE_SSH_CIPHERS = "config.ssh.ciphers";
export const RULE_SSH_MACS = "config.ssh.macs";
export const RULE_SSH_KEXALGORITHMS = "config.ssh.kexalgorithms";
export const RULE_TERRAFORM_TLS_VERSION = "config.terraform.tls_version";
export const RULE_TERRAFORM_SSL_POLICY = "config.terraform.ssl_policy";

export interface ConfigProtocolDetection {
  ruleId: string;
  relativeFilePath: string;
  lineNumber: number;
  usage: NormalizedCryptoUsage;
  fingerprint: string;
}

// ─── Fingerprinting ─────────────────────────────────────────────────────────

/**
 * Deterministic fingerprint from stable properties only — rule id, relative
 * path, line number and the normalised configured value. No scan id,
 * timestamp or temp path, mirroring computeFingerprint() in
 * js-crypto-scan.ts and computeCertKeyFingerprint() in certkey-scan.ts.
 */
export function computeConfigProtocolFingerprint(
  ruleId: string,
  relativeFilePath: string,
  lineNumber: number,
  normalizedValue: string
): string {
  const parts = [ruleId, relativeFilePath.replace(/\\/g, "/"), String(lineNumber), normalizedValue];
  return sha256("sha256").update(parts.join(" ")).digest("hex");
}

// ─── TLS/SSL protocol-version normalisation ────────────────────────────────

/** Canonicalises every spelling this project's directives can produce down to "TLSv1.0".."TLSv1.3"/"SSLv2"/"SSLv3". */
const TLS_VERSION_ALIASES: Record<string, string> = {
  "sslv2": "SSLv2",
  "sslv3": "SSLv3",
  "tlsv1": "TLSv1.0",
  "tlsv1.0": "TLSv1.0",
  "tls1.0": "TLSv1.0",
  "tls1_0": "TLSv1.0",
  "tls1-0": "TLSv1.0",
  "tlsv1.1": "TLSv1.1",
  "tls1.1": "TLSv1.1",
  "tls1_1": "TLSv1.1",
  "tls1-1": "TLSv1.1",
  "tlsv1.2": "TLSv1.2",
  "tls1.2": "TLSv1.2",
  "tls1_2": "TLSv1.2",
  "tls1-2": "TLSv1.2",
  "tlsv1.3": "TLSv1.3",
  "tls1.3": "TLSv1.3",
  "tls1_3": "TLSv1.3",
  "tls1-3": "TLSv1.3",
};

/** Returns the canonical "TLSv1.x"/"SSLv2"/"SSLv3" spelling, or null if the token isn't a recognised TLS/SSL version. */
export function normalizeTlsVersion(raw: string): string | null {
  return TLS_VERSION_ALIASES[raw.trim().toLowerCase()] ?? null;
}

// ─── Line-comment stripping ─────────────────────────────────────────────────

/** Whole-line comments only (nginx/ssh `#`, Terraform `#`/`//`) — inline trailing comments are not stripped (documented limitation). */
function isCommentOrBlankLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.length === 0 || trimmed.startsWith("#") || trimmed.startsWith("//");
}

// ─── nginx ──────────────────────────────────────────────────────────────────

const NGINX_SSL_PROTOCOLS_RE = /^\s*ssl_protocols\s+([^;]+);?/i;
const NGINX_SSL_CIPHERS_RE = /^\s*ssl_ciphers\s+([^;]+);?/i;

/** OpenSSL cipher-list filter keywords that are never themselves a concrete weak cipher suite name. */
const OPENSSL_FILTER_KEYWORDS = new Set([
  "high", "medium", "low", "all", "complementofall", "complementofdefault", "default",
  "anull", "enull", "export", "export40", "export56", "krsa", "kedh", "kdhr", "kdhd",
  "arsa", "adss", "adh", "rsa", "dh", "dhe", "edh", "ecdh", "ecdhe", "aes", "aes128",
  "aes256", "aesgcm", "aesccm", "chacha20", "camellia", "seed", "idea", "psk", "srp",
  "kecdh", "aecdsa", "eecdh", "tlsv1", "tlsv1.2", "sslv3", "fips", "!sslv2",
]);

/** Weak substrings that, if present as (or within) a non-excluded, non-keyword cipher token, mark it disallowed. */
const OPENSSL_WEAK_TOKEN_SUBSTRINGS = ["md5", "rc4", "3des", "des", "null", "export", "adh", "sslv2", "sslv3"];

function nginxProtocolUsage(token: string): NormalizedCryptoUsage | null {
  const canonical = normalizeTlsVersion(token);
  if (!canonical) return null;
  return {
    kind: "PROTOCOL",
    name: `nginx ssl_protocols: ${canonical}`,
    primitive: "tls-protocol-version",
    algorithm: canonical,
    quantumSafe: null,
    executionEnvironment: null,
  };
}

function nginxCipherUsage(token: string): NormalizedCryptoUsage | null {
  const trimmed = token.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.startsWith("!")) return null; // an exclusion, not a configured cipher
  const lower = trimmed.toLowerCase();
  if (OPENSSL_FILTER_KEYWORDS.has(lower)) return null; // a filter keyword ("HIGH"), not a concrete cipher-suite name

  const isWeak = OPENSSL_WEAK_TOKEN_SUBSTRINGS.some((weak) => lower.includes(weak));
  if (!isWeak) return null; // not a keyword we recognise as weak — never guess "unknown = bad"

  return {
    kind: "PROTOCOL",
    name: `nginx ssl_ciphers: ${trimmed}`,
    primitive: "cipher-suite",
    algorithm: trimmed,
    quantumSafe: null,
    executionEnvironment: null,
  };
}

function scanNginxLine(line: string, relativeFilePath: string, lineNumber: number): ConfigProtocolDetection[] {
  const detections: ConfigProtocolDetection[] = [];

  const protoMatch = NGINX_SSL_PROTOCOLS_RE.exec(line);
  if (protoMatch) {
    const tokens = protoMatch[1].split(/\s+/).map((t) => t.trim()).filter(Boolean);
    for (const token of tokens) {
      const usage = nginxProtocolUsage(token);
      if (!usage) continue;
      const fingerprint = computeConfigProtocolFingerprint(RULE_NGINX_SSL_PROTOCOLS, relativeFilePath, lineNumber, usage.algorithm!);
      detections.push({ ruleId: RULE_NGINX_SSL_PROTOCOLS, relativeFilePath, lineNumber, usage, fingerprint });
    }
    return detections;
  }

  const cipherMatch = NGINX_SSL_CIPHERS_RE.exec(line);
  if (cipherMatch) {
    const tokens = cipherMatch[1].split(":").map((t) => t.trim()).filter(Boolean);
    for (const token of tokens) {
      const usage = nginxCipherUsage(token);
      if (!usage) continue;
      const fingerprint = computeConfigProtocolFingerprint(RULE_NGINX_SSL_CIPHERS, relativeFilePath, lineNumber, usage.algorithm!);
      detections.push({ ruleId: RULE_NGINX_SSL_CIPHERS, relativeFilePath, lineNumber, usage, fingerprint });
    }
    return detections;
  }

  return detections;
}

// ─── sshd_config ────────────────────────────────────────────────────────────

const SSH_CIPHERS_RE = /^\s*Ciphers\s+(.+?)\s*$/i;
const SSH_MACS_RE = /^\s*MACs\s+(.+?)\s*$/i;
const SSH_KEX_RE = /^\s*KexAlgorithms\s+(.+?)\s*$/i;

function splitSshValueList(raw: string): string[] {
  // OpenSSH allows a leading '+'/'-'/'^' modifier (append/remove/prepend to
  // the default list) before the comma-separated value list.
  const withoutModifier = /^[+\-^]/.test(raw) ? raw.slice(1) : raw;
  return withoutModifier
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * Maps raw OpenSSH cipher/MAC token spellings onto the canonical algorithm
 * names deprecated-algorithms.ts's lookupTransitionStatus() already knows
 * about, so `usage.algorithm` — not just `usage.name` — actually reuses
 * that table rather than merely claiming to in a comment. Deliberately
 * small: only tokens that unambiguously reduce to an existing FLAT_TABLE
 * entry are aliased here; anything else (aes*-gcm, chacha20-poly1305,
 * hmac-sha2-*, curve25519-sha256, …) is passed through unchanged and is
 * either resolved by protocol-transitions.ts or left unclassified.
 */
const SSH_ALGORITHM_ALIASES: Record<string, string> = {
  "3des-cbc": "3DES",
  "3des": "3DES",
  "des-cbc": "DES",
  "des": "DES",
  "arcfour": "RC4",
  "arcfour128": "RC4",
  "arcfour256": "RC4",
  "hmac-md5": "MD5",
  "hmac-md5-96": "MD5",
  "hmac-md5-etm@openssh.com": "MD5",
  "hmac-md5-96-etm@openssh.com": "MD5",
  "hmac-sha1": "SHA-1",
  "hmac-sha1-96": "SHA-1",
  "hmac-sha1-etm@openssh.com": "SHA-1",
  "hmac-sha1-96-etm@openssh.com": "SHA-1",
};

function sshTokenUsage(primitive: string, token: string): NormalizedCryptoUsage {
  const canonicalAlgorithm = SSH_ALGORITHM_ALIASES[token.toLowerCase()] ?? token;
  return {
    kind: "PROTOCOL",
    // Display name keeps the exact raw configured token — only `algorithm`
    // (consulted by finding derivation) is normalised.
    name: `sshd_config ${primitive}: ${token}`,
    primitive,
    algorithm: canonicalAlgorithm,
    quantumSafe: null,
    executionEnvironment: null,
  };
}

function scanSshLine(line: string, relativeFilePath: string, lineNumber: number): ConfigProtocolDetection[] {
  const detections: ConfigProtocolDetection[] = [];

  const cipherMatch = SSH_CIPHERS_RE.exec(line);
  if (cipherMatch) {
    for (const token of splitSshValueList(cipherMatch[1])) {
      const usage = sshTokenUsage("cipher", token);
      const fingerprint = computeConfigProtocolFingerprint(RULE_SSH_CIPHERS, relativeFilePath, lineNumber, token.toLowerCase());
      detections.push({ ruleId: RULE_SSH_CIPHERS, relativeFilePath, lineNumber, usage, fingerprint });
    }
    return detections;
  }

  const macMatch = SSH_MACS_RE.exec(line);
  if (macMatch) {
    for (const token of splitSshValueList(macMatch[1])) {
      const usage = sshTokenUsage("mac", token);
      const fingerprint = computeConfigProtocolFingerprint(RULE_SSH_MACS, relativeFilePath, lineNumber, token.toLowerCase());
      detections.push({ ruleId: RULE_SSH_MACS, relativeFilePath, lineNumber, usage, fingerprint });
    }
    return detections;
  }

  const kexMatch = SSH_KEX_RE.exec(line);
  if (kexMatch) {
    for (const token of splitSshValueList(kexMatch[1])) {
      const usage = sshTokenUsage("key-exchange", token);
      const fingerprint = computeConfigProtocolFingerprint(RULE_SSH_KEXALGORITHMS, relativeFilePath, lineNumber, token.toLowerCase());
      detections.push({ ruleId: RULE_SSH_KEXALGORITHMS, relativeFilePath, lineNumber, usage, fingerprint });
    }
    return detections;
  }

  return detections;
}

// ─── Terraform ──────────────────────────────────────────────────────────────

const TF_MIN_TLS_VERSION_RE = /\b(?:minimum_tls_version|min_tls_version)\s*=\s*"([^"]+)"/i;
const TF_SSL_POLICY_RE = /\bssl_policy\s*=\s*"([^"]+)"/i;

/** Azure/GCP-style tokens: "TLS1_0", "TLS1_2", etc. */
function normalizeTerraformTlsToken(raw: string): string | null {
  return normalizeTlsVersion(raw) ?? normalizeTlsVersion(raw.replace(/^TLS/i, "TLSv"));
}

/** AWS ELB/ALB security-policy names embed a version fragment, e.g. "ELBSecurityPolicy-TLS-1-2-2017-01" or "...-TLS13-1-2-2021-06". */
function normalizeAwsSslPolicy(policyName: string): string | null {
  const lower = policyName.toLowerCase();
  if (lower.includes("tls13")) return "TLSv1.3";
  if (lower.includes("tls-1-2") || lower.includes("tls1-2")) return "TLSv1.2";
  if (lower.includes("tls-1-1") || lower.includes("tls1-1")) return "TLSv1.1";
  if (lower.includes("tls-1-0") || lower.includes("tls1-0")) return "TLSv1.0";
  return null; // unrecognised naming — never guess
}

function scanTerraformLine(line: string, relativeFilePath: string, lineNumber: number): ConfigProtocolDetection[] {
  const detections: ConfigProtocolDetection[] = [];

  const tlsMatch = TF_MIN_TLS_VERSION_RE.exec(line);
  if (tlsMatch) {
    const canonical = normalizeTerraformTlsToken(tlsMatch[1]);
    if (canonical) {
      const usage: NormalizedCryptoUsage = {
        kind: "PROTOCOL",
        name: `terraform minimum_tls_version: ${canonical}`,
        primitive: "tls-protocol-version",
        algorithm: canonical,
        quantumSafe: null,
        executionEnvironment: null,
      };
      const fingerprint = computeConfigProtocolFingerprint(RULE_TERRAFORM_TLS_VERSION, relativeFilePath, lineNumber, canonical);
      detections.push({ ruleId: RULE_TERRAFORM_TLS_VERSION, relativeFilePath, lineNumber, usage, fingerprint });
    }
    return detections;
  }

  const policyMatch = TF_SSL_POLICY_RE.exec(line);
  if (policyMatch) {
    const canonical = normalizeAwsSslPolicy(policyMatch[1]);
    if (canonical) {
      const usage: NormalizedCryptoUsage = {
        kind: "PROTOCOL",
        name: `terraform ssl_policy: ${policyMatch[1]} (${canonical})`,
        primitive: "tls-protocol-version",
        algorithm: canonical,
        quantumSafe: null,
        executionEnvironment: null,
      };
      const fingerprint = computeConfigProtocolFingerprint(RULE_TERRAFORM_SSL_POLICY, relativeFilePath, lineNumber, policyMatch[1]);
      detections.push({ ruleId: RULE_TERRAFORM_SSL_POLICY, relativeFilePath, lineNumber, usage, fingerprint });
    }
    return detections;
  }

  return detections;
}

// ─── Orchestration (still pure — no persistence) ───────────────────────────

/**
 * Scans already-read config text for crypto-relevant directives. Pure and
 * synchronous — no filesystem access — so it's directly unit-testable, and
 * works identically regardless of CRLF/LF line endings.
 */
export function scanConfigTextForProtocols(content: string, relativeFilePath: string): ConfigProtocolDetection[] {
  const isTerraform = relativeFilePath.toLowerCase().endsWith(".tf");
  const lines = content.split(/\r\n|\r|\n/);
  const detections: ConfigProtocolDetection[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isCommentOrBlankLine(line)) continue;
    const lineNumber = i + 1;

    if (isTerraform) {
      detections.push(...scanTerraformLine(line, relativeFilePath, lineNumber));
    } else {
      detections.push(...scanNginxLine(line, relativeFilePath, lineNumber));
      detections.push(...scanSshLine(line, relativeFilePath, lineNumber));
    }
  }

  return detections;
}

export async function scanConfigProtocolFiles(
  dir: string,
  onLog: DetectorLogger = () => {}
): Promise<{ detections: ConfigProtocolDetection[]; filesScanned: number; filesSkipped: number }> {
  const relativePaths = await discoverConfigProtocolFiles(dir);

  let filesScanned = 0;
  let filesSkipped = 0;
  const detections: ConfigProtocolDetection[] = [];

  for (const relPath of relativePaths) {
    const content = await readConfigFile(dir, relPath, onLog);
    if (content === null) {
      filesSkipped++;
      continue;
    }
    filesScanned++;

    try {
      detections.push(...scanConfigTextForProtocols(content, relPath));
    } catch (err) {
      await onLog("WARN", `[config-protocol] failed to analyze ${relPath}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { detections, filesScanned, filesSkipped };
}
