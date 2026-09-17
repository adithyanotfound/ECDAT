/**
 * Focused tests for the CycloneDX 1.6 CBOM builder — Phase 4, Step 6.
 *
 * Uses Node's built-in test runner (no new devDependency beyond ajv/
 * ajv-formats, needed for real schema validation — see validate.ts).
 * Tests the pure `buildCbom` function directly with hand-constructed
 * fixtures — no Prisma, no DATABASE_URL required.
 *
 * Run with:
 *   npx tsx --test src/server/cbom/build.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { buildCbom, type BuildCbomAsset, type BuildCbomInput } from "./build";
import { validateCbom } from "./validate";

const FIXED_COMPLETED_AT = new Date("2026-04-16T14:40:00.000Z");

function makeAsset(overrides: Partial<BuildCbomAsset> = {}): BuildCbomAsset {
  return {
    fingerprint: "fp-default",
    kind: "ALGORITHM",
    name: "SHA-256",
    primitive: "hash",
    keyLengthBits: null,
    curve: null,
    mode: null,
    quantumSafe: true,
    executionEnvironment: "software-plain-ram",
    classicalSecLevel: null,
    usageCount: 1,
    riskAssessment: null,
    ...overrides,
  };
}

function makeInput(assets: BuildCbomAsset[], overrides: Partial<BuildCbomInput> = {}): BuildCbomInput {
  return {
    scanId: "scan-1",
    completedAt: FIXED_COMPLETED_AT,
    assets,
    ...overrides,
  };
}

// ─── Test 1 — official schema validation (load-bearing) ───────────────────

test("a realistic multi-asset CBOM validates against the official CycloneDX 1.6 JSON Schema", () => {
  const input = makeInput([
    makeAsset({
      fingerprint: "fp-3des",
      name: "3DES",
      primitive: "block-cipher",
      keyLengthBits: 168,
      mode: "cbc",
      quantumSafe: false,
      riskAssessment: { crsfScore: 85, pqcSafetyScore: 1, riskCategory: "CRITICAL", moscaVerdict: "ACT_NOW" },
    }),
    makeAsset({
      fingerprint: "fp-rsa-cert",
      kind: "CERTIFICATE",
      name: "RSA Certificate",
      primitive: "signature",
      keyLengthBits: 2048,
      quantumSafe: false,
      riskAssessment: { crsfScore: 48, pqcSafetyScore: 2, riskCategory: "HIGH", moscaVerdict: "ACT_NOW" },
    }),
    makeAsset({
      fingerprint: "fp-ec-key",
      kind: "KEY",
      name: "EC Private Key",
      primitive: null,
      curve: "secp256r1",
      quantumSafe: false,
    }),
    makeAsset({
      fingerprint: "fp-jose",
      kind: "LIBRARY",
      name: "jose",
      primitive: null,
      quantumSafe: null,
    }),
  ]);

  const cbom = buildCbom(input);
  const { valid, errors } = validateCbom(cbom);

  assert.deepEqual(errors, []);
  assert.equal(valid, true);
});

test("an empty inventory still produces a schema-valid CBOM", () => {
  const cbom = buildCbom(makeInput([]));
  const { valid, errors } = validateCbom(cbom);

  assert.deepEqual(errors, []);
  assert.equal(valid, true);
  assert.deepEqual(cbom.components, []);
  assert.deepEqual(cbom.dependencies, []);
});

test("shallow-looking negative check: an actually-invalid document is rejected (proves the validator isn't a no-op)", () => {
  const { valid, errors } = validateCbom({ bomFormat: "NotCycloneDX" });
  assert.equal(valid, false);
  assert.ok(errors.length > 0);
});

// ─── Test 2 — 3DES mapping matches the implementation-plan marker vocabulary ─

test("3DES maps exactly to the implementation-plan drawer vocabulary", () => {
  const cbom = buildCbom(
    makeInput([
      makeAsset({
        fingerprint: "fp-3des",
        name: "3DES",
        primitive: "block-cipher",
        keyLengthBits: 168,
        mode: "cbc",
        quantumSafe: false,
        riskAssessment: { crsfScore: 85, pqcSafetyScore: 1, riskCategory: "CRITICAL", moscaVerdict: "ACT_NOW" },
      }),
    ])
  );

  const [component] = cbom.components;
  assert.equal(component.type, "cryptographic-asset");
  assert.equal(component.cryptoProperties?.assetType, "algorithm");

  const algo = component.cryptoProperties?.algorithmProperties;
  assert.equal(algo?.primitive, "block-cipher");
  assert.equal(algo?.mode, "cbc");
  assert.equal(algo?.parameterSetIdentifier, "168"); // string, not number
  assert.equal(algo?.nistQuantumSecurityLevel, 0);
  assert.equal(algo?.executionEnvironment, "software-plain-ram");

  const { valid } = validateCbom(cbom);
  assert.equal(valid, true);
});

// ─── Test 3 — deterministic serial number ──────────────────────────────────

test("building the same scan's CBOM twice yields an identical serialNumber", () => {
  const input = makeInput([makeAsset()]);
  const cbom1 = buildCbom(input);
  const cbom2 = buildCbom(input);

  assert.equal(cbom1.serialNumber, cbom2.serialNumber);
  assert.match(cbom1.serialNumber, /^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test("different scanIds produce different serial numbers", () => {
  const cbomA = buildCbom(makeInput([makeAsset()], { scanId: "scan-a" }));
  const cbomB = buildCbom(makeInput([makeAsset()], { scanId: "scan-b" }));
  assert.notEqual(cbomA.serialNumber, cbomB.serialNumber);
});

// ─── Test 4 — LIBRARY mapping ───────────────────────────────────────────────

test("a LIBRARY CryptoAsset becomes type 'library', never 'cryptographic-asset'", () => {
  const cbom = buildCbom(makeInput([makeAsset({ kind: "LIBRARY", name: "jose", primitive: null })]));

  const [component] = cbom.components;
  assert.equal(component.type, "library");
  assert.equal(component.cryptoProperties, undefined);
});

// ─── Edge cases ─────────────────────────────────────────────────────────────

test("multiple CryptoAssets each produce their own component and dependency entry", () => {
  const cbom = buildCbom(
    makeInput([
      makeAsset({ fingerprint: "fp-1", name: "SHA-256" }),
      makeAsset({ fingerprint: "fp-2", name: "AES-256-GCM", primitive: "block-cipher", mode: "gcm" }),
      makeAsset({ fingerprint: "fp-3", kind: "LIBRARY", name: "node-forge", primitive: null }),
    ])
  );

  assert.equal(cbom.components.length, 3);
  assert.equal(cbom.dependencies.length, 3);
  for (const dep of cbom.dependencies) {
    assert.deepEqual(dep.dependsOn, []);
  }
});

test("a missing RiskAssessment omits ecdat: risk properties but still includes usageCount", () => {
  const cbom = buildCbom(makeInput([makeAsset({ riskAssessment: null, usageCount: 3 })]));
  const props = cbom.components[0].properties ?? [];

  assert.ok(props.some((p) => p.name === "ecdat:usageCount" && p.value === "3"));
  assert.ok(!props.some((p) => p.name === "ecdat:crsfScore"));
});

test("quantumSafe true maps to a non-zero nistQuantumSecurityLevel placeholder", () => {
  const cbom = buildCbom(makeInput([makeAsset({ quantumSafe: true })]));
  assert.equal(cbom.components[0].cryptoProperties?.algorithmProperties?.nistQuantumSecurityLevel, 1);
});

test("quantumSafe false maps to nistQuantumSecurityLevel 0", () => {
  const cbom = buildCbom(makeInput([makeAsset({ quantumSafe: false })]));
  assert.equal(cbom.components[0].cryptoProperties?.algorithmProperties?.nistQuantumSecurityLevel, 0);
});

test("quantumSafe null omits nistQuantumSecurityLevel entirely rather than fabricating a value", () => {
  const cbom = buildCbom(makeInput([makeAsset({ quantumSafe: null })]));
  assert.equal(cbom.components[0].cryptoProperties?.algorithmProperties?.nistQuantumSecurityLevel, undefined);
  const { valid } = validateCbom(cbom);
  assert.equal(valid, true);
});

test("a CERTIFICATE asset maps to cryptographic-asset / assetType certificate", () => {
  const cbom = buildCbom(makeInput([makeAsset({ kind: "CERTIFICATE", name: "RSA Certificate", primitive: "signature", keyLengthBits: 2048 })]));
  const component = cbom.components[0];
  assert.equal(component.type, "cryptographic-asset");
  assert.equal(component.cryptoProperties?.assetType, "certificate");
});

test("a KEY asset maps to cryptographic-asset / assetType related-crypto-material", () => {
  const cbom = buildCbom(makeInput([makeAsset({ kind: "KEY", name: "EC Private Key", primitive: null, curve: "secp256r1" })]));
  const component = cbom.components[0];
  assert.equal(component.type, "cryptographic-asset");
  assert.equal(component.cryptoProperties?.assetType, "related-crypto-material");
});

test("a PROTOCOL asset maps to cryptographic-asset / assetType protocol", () => {
  const cbom = buildCbom(makeInput([makeAsset({ kind: "PROTOCOL", name: "TLS 1.3", primitive: null })]));
  const component = cbom.components[0];
  assert.equal(component.type, "cryptographic-asset");
  assert.equal(component.cryptoProperties?.assetType, "protocol");
});

test("bom-refs are unique across all components", () => {
  const cbom = buildCbom(
    makeInput([
      makeAsset({ fingerprint: "fp-a" }),
      makeAsset({ fingerprint: "fp-b" }),
      makeAsset({ fingerprint: "fp-c", kind: "LIBRARY", primitive: null }),
    ])
  );
  const refs = cbom.components.map((c) => c["bom-ref"]);
  assert.equal(new Set(refs).size, refs.length);
});

test("metadata.timestamp uses Scan.completedAt, not a freshly generated timestamp", () => {
  const cbom = buildCbom(makeInput([makeAsset()]));
  assert.equal(cbom.metadata.timestamp, FIXED_COMPLETED_AT.toISOString());
});

test("an unrecognised mode/primitive falls back to a schema-valid 'other'/'unknown' rather than an invalid enum value", () => {
  const cbom = buildCbom(
    makeInput([makeAsset({ primitive: "some-future-primitive", mode: "xts" })])
  );
  const algo = cbom.components[0].cryptoProperties?.algorithmProperties;
  assert.equal(algo?.primitive, "unknown");
  assert.equal(algo?.mode, "other");
  const { valid } = validateCbom(cbom);
  assert.equal(valid, true);
});
