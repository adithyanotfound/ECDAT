/**
 * `npm run test:cbom` — the CBOM schema regression test named in
 * IMPLEMENTATION_PLAN.md §Phase 5 ("CI running ... the CBOM schema test").
 *
 * Runs the real engine over a small synthetic fixture tree (no DB, no
 * network), builds a CycloneDX 1.6 CBOM from the hits, and validates it
 * against the structural schema in src/server/engine/cbom.ts. Doubles as a
 * smoke test that the detector pipeline still produces artefacts at all.
 */
import "reflect-metadata";
import { mkdtemp, rm, mkdir, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { runEngine } from "../src/server/engine/scan";
import { buildCbom, validateCbom, type CbomAssetInput } from "../src/server/engine/cbom";

const FIXTURE_FILES: Record<string, string> = {
  "src/crypto.ts": `
    import { createCipheriv, createHash } from "crypto";
    const cipher = createCipheriv("des-ede3-cbc", key, iv);
    const digest = createHash("md5").update(data).digest("hex");
  `,
  "app.py": `
    import hashlib
    token = hashlib.md5(payload).hexdigest()
  `,
  "server.go": `
    import "crypto/sha256"
    import "crypto/tls"
    cfg := &tls.Config{ MinVersion: tls.VersionTLS12 }
  `,
  "certs/server.pem": `-----BEGIN CERTIFICATE-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA1c7+9z5Pad7OejecsQ0bu1uEojFB
-----END CERTIFICATE-----`,
};

async function main() {
  const dir = await mkdtemp(join(tmpdir(), "ecdat-cbom-test-"));
  try {
    for (const [relPath, content] of Object.entries(FIXTURE_FILES)) {
      const dest = join(dir, relPath);
      await mkdir(join(dest, ".."), { recursive: true });
      await writeFile(dest, content, "utf-8");
    }

    const result = await runEngine("test-repo", dir, {}, (level, message) => {
      if (level !== "INFO") console.log(`[engine:${level}] ${message}`);
    });

    if (result.hits.length === 0) {
      console.error("FAIL: engine produced zero hits over the fixture tree — detector regression");
      process.exit(1);
    }
    console.log(`Engine produced ${result.hits.length} hits over ${result.filesScanned} files`);

    const assets: CbomAssetInput[] = result.hits.map((h, i) => ({
      id: `asset-${i}`,
      kind: h.kind,
      name: h.canonicalName,
      primitive: h.primitive ?? null,
      mode: h.mode ?? null,
      padding: h.padding ?? null,
      keyLengthBits: h.keyLengthBits ?? null,
      curve: h.curve ?? null,
      nistQuantumLevel: h.nistQuantumLevel ?? null,
      classicalSecLevel: h.classicalSecLevel ?? null,
      executionEnvironment: h.executionEnvironment ?? null,
      filePath: h.filePath,
      usageCount: 1,
      lastSeenAt: new Date().toISOString(),
    }));

    const cbom = buildCbom({
      repositoryFullName: "ecdat/cbom-fixture",
      commitSha: "0000000",
      scanId: "test-scan",
      assets,
    });

    const validation = validateCbom(cbom);
    if (!validation.valid) {
      console.error("FAIL: CBOM did not validate against the CycloneDX 1.6 structural schema:");
      for (const err of validation.errors) console.error(`  - ${err}`);
      process.exit(1);
    }

    console.log(`PASS: CBOM valid — ${cbom.components.length} cryptographic-asset components, spec ${cbom.specVersion}`);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
