/**
 * Focused tests for the certificate/key detector — Phase 4, Step 4.
 *
 * Uses Node's built-in test runner (no new devDependency), mirroring
 * js-crypto.test.ts and manifest.test.ts. Tests exercise the pure
 * certkey-scan.ts scanner directly — no database is touched.
 *
 * Run with:
 *   npx tsx --test src/server/detectors/certkey.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { generateKeyPairSync } from "node:crypto";
import os from "node:os";
import path from "node:path";
import * as forge from "node-forge";

import { computeCertKeyFingerprint, discoverCertKeyFiles, scanCertKeyFiles } from "./certkey-scan";

// ─── Fixture generation ─────────────────────────────────────────────────────
// RSA keys are generated via Node's native (fast) keygen, then imported into
// node-forge only for cert building/signing — forge's own pure-JS RSA keygen
// is slow enough to make a test suite sluggish.

interface RsaCertFixture {
  certPem: string;
  keyPem: string; // PKCS#1 "RSA PRIVATE KEY"
}

function generateSelfSignedRsaCert(commonName = "test.example.com"): RsaCertFixture {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  const keyPem = privateKey.export({ type: "pkcs1", format: "pem" }).toString();

  const forgePublicKey = forge.pki.publicKeyFromPem(publicKeyPem);
  const forgePrivateKey = forge.pki.privateKeyFromPem(keyPem);

  const cert = forge.pki.createCertificate();
  cert.publicKey = forgePublicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
  const attrs = [{ name: "commonName", value: commonName }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(forgePrivateKey, forge.md.sha256.create());

  return { certPem: forge.pki.certificateToPem(cert), keyPem };
}

function pemToDer(pem: string): Buffer {
  const base64 = pem
    .replace(/-----BEGIN [^-]+-----/, "")
    .replace(/-----END [^-]+-----/, "")
    .replace(/\s+/g, "");
  return Buffer.from(base64, "base64");
}

function generateEcPrivateKeyPem(namedCurve = "prime256v1"): string {
  const { privateKey } = generateKeyPairSync("ec", { namedCurve });
  return privateKey.export({ type: "sec1", format: "pem" }).toString();
}

// Generated once and reused — real RSA keygen/cert-signing on every test would be wasteful.
const rsaFixture = generateSelfSignedRsaCert();

async function writeFileDeep(filePath: string, data: string | Buffer): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, data);
}

async function withTempRepo(fn: (repoDir: string) => Promise<void>): Promise<void> {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "ecdat-certkey-test-"));
  try {
    await fn(tmp);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

// ─── Test 1 — valid self-signed PEM certificate ────────────────────────────

test("detects a valid self-signed PEM certificate and extracts metadata", async () => {
  await withTempRepo(async (repo) => {
    await writeFileDeep(path.join(repo, "server.pem"), rsaFixture.certPem);

    const { detections, filesScanned } = await scanCertKeyFiles(repo);

    assert.equal(filesScanned, 1);
    assert.equal(detections.length, 1);
    const [d] = detections;
    assert.equal(d.usage.kind, "CERTIFICATE");
    assert.equal(d.usage.algorithm, "RSA");
    assert.equal(d.usage.keyLengthBits, 2048);
    assert.equal(d.usage.quantumSafe, false);
    assert.equal(d.usage.subject, "CN=test.example.com");
    assert.ok(d.usage.notAfter);
    assert.ok(d.usage.notBefore);
    assert.equal(d.ruleId, "certkey.pem.certificate");
    assert.equal(d.relativeFilePath, "server.pem");
  });
});

// ─── Test 2 — PEM RSA private key ──────────────────────────────────────────

test("detects a PEM RSA private key (PKCS#1) and extracts algorithm/key length only", async () => {
  await withTempRepo(async (repo) => {
    await writeFileDeep(path.join(repo, "server.key"), rsaFixture.keyPem);

    const { detections } = await scanCertKeyFiles(repo);

    assert.equal(detections.length, 1);
    const [d] = detections;
    assert.equal(d.usage.kind, "KEY");
    assert.equal(d.usage.algorithm, "RSA");
    assert.equal(d.usage.keyLengthBits, 2048);
    assert.equal(d.usage.curve, null);
    assert.equal(d.usage.quantumSafe, false);
    assert.equal(d.ruleId, "certkey.pem.privatekey.rsa");
  });
});

// ─── Test 3 — PEM EC private key with named curve ──────────────────────────

test("detects a PEM EC private key and preserves the curve name", async () => {
  await withTempRepo(async (repo) => {
    const ecKeyPem = generateEcPrivateKeyPem("prime256v1");
    await writeFileDeep(path.join(repo, "ec.key"), ecKeyPem);

    const { detections } = await scanCertKeyFiles(repo);

    assert.equal(detections.length, 1);
    const [d] = detections;
    assert.equal(d.usage.kind, "KEY");
    assert.equal(d.usage.algorithm, "EC");
    assert.equal(d.usage.curve, "secp256r1"); // canonicalised from OpenSSL's "prime256v1"
    assert.equal(d.usage.keyLengthBits, null);
    assert.equal(d.ruleId, "certkey.pem.privatekey.ec");
  });
});

// ─── Test 4 — malformed/truncated PEM ──────────────────────────────────────

test("a truncated PEM block (no END marker) is skipped without throwing", async () => {
  await withTempRepo(async (repo) => {
    await writeFileDeep(path.join(repo, "broken.pem"), "-----BEGIN CERTIFICATE-----\nMIIBxxxxNotComplete\n");

    const { detections, filesScanned } = await scanCertKeyFiles(repo);

    assert.equal(filesScanned, 1);
    assert.deepEqual(detections, []);
  });
});

test("a well-formed but unparsable certificate block is skipped, logged, and does not abort the scan", async () => {
  await withTempRepo(async (repo) => {
    await writeFileDeep(
      path.join(repo, "corrupt.pem"),
      "-----BEGIN CERTIFICATE-----\nTk9UIFZBTElEIERFUiBDT05URU5UIQ==\n-----END CERTIFICATE-----\n"
    );
    await writeFileDeep(path.join(repo, "good.pem"), rsaFixture.certPem);

    const messages: string[] = [];
    const { detections, filesScanned } = await scanCertKeyFiles(repo, (_level, message) => {
      messages.push(message);
    });

    assert.equal(filesScanned, 2);
    assert.equal(detections.length, 1); // only the good one
    assert.equal(detections[0].relativeFilePath, "good.pem");
    assert.ok(messages.some((m) => m.includes("malformed certificate block") && m.includes("corrupt.pem")));
  });
});

// ─── Test 5 — JKS file ──────────────────────────────────────────────────────

test("emits exactly one unparsed KEY asset for a .jks file", async () => {
  await withTempRepo(async (repo) => {
    await writeFileDeep(path.join(repo, "keystore.jks"), Buffer.from([0xfe, 0xed, 0xfe, 0xed, 0x00, 0x02]));

    const { detections } = await scanCertKeyFiles(repo);

    assert.equal(detections.length, 1);
    const [d] = detections;
    assert.equal(d.ruleId, "certkey.jks.unparsed");
    assert.equal(d.usage.kind, "KEY");
    assert.equal(d.usage.name, "JKS keystore (unparsed)");
    assert.equal(d.usage.algorithm, null);
    assert.equal(d.usage.keyLengthBits, null);
    assert.equal(d.usage.curve, null);
  });
});

// ─── Test 6 — multiple certificate blocks in one file ──────────────────────

test("handles multiple certificate blocks in a single file independently", async () => {
  await withTempRepo(async (repo) => {
    const second = generateSelfSignedRsaCert("second.example.com");
    await writeFileDeep(path.join(repo, "chain.pem"), rsaFixture.certPem + second.certPem);

    const { detections } = await scanCertKeyFiles(repo);

    assert.equal(detections.length, 2);
    assert.equal(detections[0].blockIndex, 0);
    assert.equal(detections[1].blockIndex, 1);
    assert.notEqual(detections[0].fingerprint, detections[1].fingerprint);
  });
});

// ─── Test 7 — DER certificate ───────────────────────────────────────────────

test("detects a DER-encoded certificate", async () => {
  await withTempRepo(async (repo) => {
    await writeFileDeep(path.join(repo, "server.der"), pemToDer(rsaFixture.certPem));

    const { detections } = await scanCertKeyFiles(repo);

    assert.equal(detections.length, 1);
    const [d] = detections;
    assert.equal(d.usage.kind, "CERTIFICATE");
    assert.equal(d.usage.algorithm, "RSA");
    assert.equal(d.ruleId, "certkey.der.certificate");
    assert.equal(d.relativeFilePath, "server.der");
  });
});

test("a .crt file containing raw DER (no PEM markers) is still parsed as a certificate", async () => {
  await withTempRepo(async (repo) => {
    await writeFileDeep(path.join(repo, "server.crt"), pemToDer(rsaFixture.certPem));

    const { detections } = await scanCertKeyFiles(repo);

    assert.equal(detections.length, 1);
    assert.equal(detections[0].usage.kind, "CERTIFICATE");
  });
});

// ─── Test 8 — P12/PFX unparsed behavior ────────────────────────────────────

test("emits exactly one unparsed KEY asset for a .p12/.pfx file, never attempting to parse it", async () => {
  await withTempRepo(async (repo) => {
    await writeFileDeep(path.join(repo, "bundle.p12"), Buffer.from([0x30, 0x82, 0x01, 0x00]));
    await writeFileDeep(path.join(repo, "bundle.pfx"), Buffer.from([0x30, 0x82, 0x01, 0x00]));

    const { detections } = await scanCertKeyFiles(repo);

    assert.equal(detections.length, 2);
    for (const d of detections) {
      assert.equal(d.ruleId, "certkey.p12.unparsed");
      assert.equal(d.usage.name, "PKCS#12 bundle (password-protected, unparsed)");
      assert.equal(d.usage.algorithm, null);
      assert.equal(d.usage.quantumSafe, null);
    }
  });
});

// ─── Test 9 — fingerprint determinism ──────────────────────────────────────

test("fingerprints are deterministic across repeated scans of the same fixtures", async () => {
  await withTempRepo(async (repo) => {
    await writeFileDeep(path.join(repo, "server.pem"), rsaFixture.certPem);
    await writeFileDeep(path.join(repo, "server.key"), rsaFixture.keyPem);

    const first = await scanCertKeyFiles(repo);
    const second = await scanCertKeyFiles(repo);

    assert.deepEqual(
      first.detections.map((d) => d.fingerprint).sort(),
      second.detections.map((d) => d.fingerprint).sort()
    );
  });
});

test("computeCertKeyFingerprint is a pure deterministic function", () => {
  const a = computeCertKeyFingerprint("certkey.pem.certificate", "server.pem", 0, "RSA", "2048");
  const b = computeCertKeyFingerprint("certkey.pem.certificate", "server.pem", 0, "RSA", "2048");
  assert.equal(a, b);
  assert.notEqual(a, computeCertKeyFingerprint("certkey.pem.certificate", "server.pem", 1, "RSA", "2048"));
});

// ─── Test 10 — relative path normalization ─────────────────────────────────

test("reports repository-relative paths for nested files, never an absolute temp path", async () => {
  await withTempRepo(async (repo) => {
    await writeFileDeep(path.join(repo, "certs", "tls", "server.pem"), rsaFixture.certPem);

    const { detections } = await scanCertKeyFiles(repo);

    assert.equal(detections.length, 1);
    assert.equal(detections[0].relativeFilePath, "certs/tls/server.pem");
    assert.ok(!path.isAbsolute(detections[0].relativeFilePath));
    assert.ok(!detections[0].relativeFilePath.includes(os.tmpdir().replace(/\\/g, "/")));
  });
});

// ─── Test 11 — no private-key material leaks ───────────────────────────────

test("no private-key material appears in returned metadata or log messages", async () => {
  await withTempRepo(async (repo) => {
    await writeFileDeep(path.join(repo, "server.key"), rsaFixture.keyPem);
    await writeFileDeep(path.join(repo, "server.pem"), rsaFixture.certPem);

    const messages: string[] = [];
    const { detections } = await scanCertKeyFiles(repo, (_level, message) => {
      messages.push(message);
    });

    // A stable, sufficiently long substring of the raw base64 key body.
    const keyBodyLine = rsaFixture.keyPem.split("\n").find((line) => line.length > 40 && !line.includes("-----"));
    assert.ok(keyBodyLine, "test fixture must have a real base64 body line");

    const serializedDetections = JSON.stringify(detections);
    assert.ok(!serializedDetections.includes(keyBodyLine!));
    for (const message of messages) {
      assert.ok(!message.includes(keyBodyLine!));
      assert.ok(!message.includes("BEGIN RSA PRIVATE KEY"));
    }
  });
});

// ─── Test 12 — excluded node_modules/.git ──────────────────────────────────

test("ignores certificate/key files under node_modules and .git", async () => {
  await withTempRepo(async (repo) => {
    await writeFileDeep(path.join(repo, "server.pem"), rsaFixture.certPem);
    await writeFileDeep(path.join(repo, "node_modules", "pkg", "fixture.pem"), rsaFixture.certPem);
    await writeFileDeep(path.join(repo, ".git", "fixture.pem"), rsaFixture.certPem);

    const files = await discoverCertKeyFiles(repo);
    assert.deepEqual(files, ["server.pem"]);

    const { detections, filesScanned } = await scanCertKeyFiles(repo);
    assert.equal(filesScanned, 1);
    assert.equal(detections.length, 1);
    assert.equal(detections[0].relativeFilePath, "server.pem");
  });
});
