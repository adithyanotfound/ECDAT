/**
 * Focused tests for the config/protocol detector — Phase 5, Step 8.
 *
 * Uses Node's built-in test runner, mirroring js-crypto.test.ts and
 * certkey.test.ts. Tests exercise the pure config-protocol-scan.ts scanner
 * directly (plus real file discovery in a temp dir for the two tests that
 * need it) — no database is touched.
 *
 * Run with:
 *   npx tsx --test src/server/detectors/config-protocol.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  scanConfigTextForProtocols,
  discoverConfigProtocolFiles,
  computeConfigProtocolFingerprint,
  RULE_NGINX_SSL_PROTOCOLS,
  RULE_NGINX_SSL_CIPHERS,
  RULE_SSH_CIPHERS,
  RULE_SSH_MACS,
  RULE_SSH_KEXALGORITHMS,
  RULE_TERRAFORM_TLS_VERSION,
} from "./config-protocol-scan";

// ─── 1. nginx ssl_protocols ─────────────────────────────────────────────────

test("detects nginx ssl_protocols and flags TLSv1/TLSv1.1 individually", () => {
  const content = "ssl_protocols TLSv1 TLSv1.1 TLSv1.2;\n";
  const detections = scanConfigTextForProtocols(content, "nginx.conf");

  assert.equal(detections.length, 3);
  assert.deepEqual(
    detections.map((d) => d.usage.algorithm).sort(),
    ["TLSv1.0", "TLSv1.1", "TLSv1.2"]
  );
  for (const d of detections) {
    assert.equal(d.ruleId, RULE_NGINX_SSL_PROTOCOLS);
    assert.equal(d.usage.kind, "PROTOCOL");
    assert.equal(d.lineNumber, 1);
  }
});

test("nginx ssl_protocols with only TLSv1.2/TLSv1.3 still creates PROTOCOL assets (asset existence != finding)", () => {
  const content = "ssl_protocols TLSv1.2 TLSv1.3;\n";
  const detections = scanConfigTextForProtocols(content, "nginx.conf");
  assert.deepEqual(
    detections.map((d) => d.usage.algorithm).sort(),
    ["TLSv1.2", "TLSv1.3"]
  );
});

// ─── 2. nginx ssl_ciphers ───────────────────────────────────────────────────

test("detects a genuinely weak nginx ssl_ciphers token (RC4-MD5)", () => {
  const content = "ssl_ciphers RC4-MD5:HIGH;\n";
  const detections = scanConfigTextForProtocols(content, "nginx.conf");

  assert.equal(detections.length, 1);
  assert.equal(detections[0].ruleId, RULE_NGINX_SSL_CIPHERS);
  assert.equal(detections[0].usage.algorithm, "RC4-MD5");
});

test("ssl_ciphers HIGH:!aNULL:!MD5 produces zero detections — exclusions and filter keywords, not weak ciphers", () => {
  const content = "ssl_ciphers HIGH:!aNULL:!MD5;\n";
  const detections = scanConfigTextForProtocols(content, "nginx.conf");
  assert.equal(detections.length, 0);
});

// ─── 3-5. sshd_config ───────────────────────────────────────────────────────

test("detects sshd_config Ciphers, normalising 3des-cbc onto the existing algorithm table's canonical '3DES'", () => {
  const content = "Ciphers 3des-cbc,aes256-ctr\n";
  const detections = scanConfigTextForProtocols(content, "sshd_config");

  assert.equal(detections.length, 2);
  assert.equal(detections[0].ruleId, RULE_SSH_CIPHERS);
  // usage.name keeps the exact raw token; usage.algorithm is normalised so
  // finding derivation reuses deprecated-algorithms.ts's existing 3DES entry.
  assert.equal(detections[0].usage.name.includes("3des-cbc"), true);
  assert.deepEqual(
    detections.map((d) => d.usage.algorithm),
    ["3DES", "aes256-ctr"]
  );
});

test("detects sshd_config MACs, normalising hmac-sha1 onto the existing algorithm table's canonical 'SHA-1'", () => {
  const content = "MACs hmac-sha1,hmac-sha2-256\n";
  const detections = scanConfigTextForProtocols(content, "sshd_config");

  assert.equal(detections.length, 2);
  assert.equal(detections[0].ruleId, RULE_SSH_MACS);
  assert.deepEqual(
    detections.map((d) => d.usage.algorithm),
    ["SHA-1", "hmac-sha2-256"]
  );
});

test("detects sshd_config KexAlgorithms", () => {
  const content = "KexAlgorithms diffie-hellman-group1-sha1\n";
  const detections = scanConfigTextForProtocols(content, "sshd_config");

  assert.equal(detections.length, 1);
  assert.equal(detections[0].ruleId, RULE_SSH_KEXALGORITHMS);
  assert.equal(detections[0].usage.algorithm, "diffie-hellman-group1-sha1");
});

// ─── 6. Terraform ───────────────────────────────────────────────────────────

test("detects Terraform minimum_tls_version", () => {
  const content = 'resource "azurerm_storage_account" "x" {\n  minimum_tls_version = "TLS1_0"\n}\n';
  const detections = scanConfigTextForProtocols(content, "main.tf");

  assert.equal(detections.length, 1);
  assert.equal(detections[0].ruleId, RULE_TERRAFORM_TLS_VERSION);
  assert.equal(detections[0].usage.algorithm, "TLSv1.0");
  assert.equal(detections[0].lineNumber, 2);
});

test("unrecognised Terraform ssl_policy naming is never guessed", () => {
  const content = 'ssl_policy = "SomeCustomPolicyName"\n';
  const detections = scanConfigTextForProtocols(content, "main.tf");
  assert.equal(detections.length, 0);
});

// ─── 7. unrelated configuration is ignored ─────────────────────────────────

test("unrelated nginx/terraform/ssh configuration produces zero detections", () => {
  const nginx = "worker_processes auto;\nlisten 80;\nroot /var/www/html;\n";
  const ssh = "Port 22\nPermitRootLogin no\n";
  const tf = 'resource "aws_instance" "x" {\n  ami = "ami-123456"\n}\n';

  assert.equal(scanConfigTextForProtocols(nginx, "nginx.conf").length, 0);
  assert.equal(scanConfigTextForProtocols(ssh, "sshd_config").length, 0);
  assert.equal(scanConfigTextForProtocols(tf, "main.tf").length, 0);
});

// ─── 8. comments ────────────────────────────────────────────────────────────

test("commented-out directives do not produce detections", () => {
  const content = "# ssl_protocols TLSv1 TLSv1.1;\n// minimum_tls_version = \"TLS1_0\"\nssl_protocols TLSv1.3;\n";
  const nginxDetections = scanConfigTextForProtocols(content, "nginx.conf");
  assert.equal(nginxDetections.length, 1); // only the real, uncommented line
  assert.equal(nginxDetections[0].usage.algorithm, "TLSv1.3");
});

// ─── 9. relative paths are deterministic ───────────────────────────────────

test("file discovery returns deterministic, sorted relative paths", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "ecdat-config-protocol-"));
  try {
    await mkdir(path.join(dir, "conf.d"), { recursive: true });
    await writeFile(path.join(dir, "conf.d", "b.conf"), "ssl_protocols TLSv1.3;\n");
    await writeFile(path.join(dir, "nginx.conf"), "ssl_protocols TLSv1.3;\n");
    await writeFile(path.join(dir, "sshd_config"), "Ciphers aes256-ctr\n");

    const files = await discoverConfigProtocolFiles(dir);
    assert.deepEqual(files, [...files].sort());
    assert.ok(files.includes("nginx.conf"));
    assert.ok(files.includes("sshd_config"));
    assert.ok(files.some((f) => f.replace(/\\/g, "/") === "conf.d/b.conf"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// ─── 10-11. fingerprint determinism/distinctness ───────────────────────────

test("the same input produces the same fingerprint", () => {
  const content = "ssl_protocols TLSv1.1;\n";
  const a = scanConfigTextForProtocols(content, "nginx.conf");
  const b = scanConfigTextForProtocols(content, "nginx.conf");
  assert.equal(a[0].fingerprint, b[0].fingerprint);
});

test("different configured values produce distinct fingerprints", () => {
  const a = scanConfigTextForProtocols("ssl_protocols TLSv1.1;\n", "nginx.conf");
  const b = scanConfigTextForProtocols("ssl_protocols TLSv1.2;\n", "nginx.conf");
  assert.notEqual(a[0].fingerprint, b[0].fingerprint);
});

test("computeConfigProtocolFingerprint never includes a scan id or timestamp — same call always agrees", () => {
  const f1 = computeConfigProtocolFingerprint(RULE_NGINX_SSL_PROTOCOLS, "nginx.conf", 3, "TLSv1.1");
  const f2 = computeConfigProtocolFingerprint(RULE_NGINX_SSL_PROTOCOLS, "nginx.conf", 3, "TLSv1.1");
  assert.equal(f1, f2);
});

// ─── 12. multiple values on one directive ──────────────────────────────────

test("multiple comma-separated sshd_config values are handled independently, each with its own fingerprint", () => {
  const content = "MACs hmac-md5,hmac-sha2-512\n";
  const detections = scanConfigTextForProtocols(content, "sshd_config");
  assert.equal(detections.length, 2);
  assert.notEqual(detections[0].fingerprint, detections[1].fingerprint);
});

test("a leading +/-/^ modifier on an sshd_config value list is stripped before splitting", () => {
  const content = "Ciphers +aes256-ctr,chacha20-poly1305@openssh.com\n";
  const detections = scanConfigTextForProtocols(content, "sshd_config");
  assert.equal(detections.length, 2);
  assert.equal(detections[0].usage.algorithm, "aes256-ctr");
});

// ─── 13. CRLF/LF ────────────────────────────────────────────────────────────

test("CRLF line endings are handled identically to LF", () => {
  const lf = "ssl_protocols TLSv1.1;\nssl_protocols TLSv1.3;\n";
  const crlf = "ssl_protocols TLSv1.1;\r\nssl_protocols TLSv1.3;\r\n";

  const lfDetections = scanConfigTextForProtocols(lf, "nginx.conf");
  const crlfDetections = scanConfigTextForProtocols(crlf, "nginx.conf");

  assert.equal(lfDetections.length, crlfDetections.length);
  assert.deepEqual(
    lfDetections.map((d) => d.lineNumber),
    crlfDetections.map((d) => d.lineNumber)
  );
});

// ─── 14. empty configuration ────────────────────────────────────────────────

test("empty configuration content does not crash and produces zero detections", () => {
  assert.deepEqual(scanConfigTextForProtocols("", "nginx.conf"), []);
  assert.deepEqual(scanConfigTextForProtocols("\n\n\n", "sshd_config"), []);
  assert.deepEqual(scanConfigTextForProtocols("   \n", "main.tf"), []);
});
