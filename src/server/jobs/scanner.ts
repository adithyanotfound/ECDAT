/**
 * No-op scanner — Phase 3 placeholder.
 * Writes plausible CryptoAsset, RiskAssessment and Finding rows so the
 * full job loop is provably working before Phase 4 plugs in the real engine.
 *
 * Phase 4 will replace runScanner() with the real detector pipeline.
 */
import { prisma } from "@/server/db/client";

const NOOP_ALGOS = [
  { name: "AES-256-GCM", primitive: "block-cipher", key: 256, mode: "GCM", qs: true, crsf: 3, pqc: 9 },
  { name: "RSA-2048", primitive: "signature", key: 2048, qs: false, crsf: 48, pqc: 4 },
  { name: "SHA-256", primitive: "hash", key: 256, qs: true, crsf: 5, pqc: 8 },
  { name: "3DES", primitive: "block-cipher", key: 168, mode: "CBC", qs: false, crsf: 85, pqc: 1 },
  { name: "HMAC-SHA256", primitive: "mac", key: 256, qs: true, crsf: 8, pqc: 8 },
  { name: "ECDSA-P256", primitive: "signature", key: 256, qs: false, crsf: 40, pqc: 4 },
];

const NOOP_FINDINGS = [
  { code: "NOOP-PQC-001", severity: "MODERATE" as const, title: "No post-quantum key exchange detected", detail: "Repository has no PQC or hybrid key exchange. Add ML-KEM-768 or X25519MLKEM768." },
  { code: "NOOP-HASH-001", severity: "HIGH" as const, title: "Weak hash function in use", detail: "SHA-1 or MD5 detected. Migrate to SHA-256 or SHA3-256." },
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function runScanner(
  scanId: string,
  repositoryId: string
): Promise<{ assetsWritten: number; findingsWritten: number }> {
  await appendLog(scanId, "INFO", "[noop-scanner] Phase 3 placeholder — writing synthetic rows");
  await appendLog(scanId, "INFO", "[noop-scanner] Running detector: algorithms");

  const numAssets = 6 + Math.floor(Math.random() * 6);
  let assetsWritten = 0;

  for (let i = 0; i < numAssets; i++) {
    const algo = pick(NOOP_ALGOS);
    const filePath = `/src/${pick(["crypto", "auth", "utils"])}/${pick(["cipher", "hash", "key"])}.ts`;
    const fingerprint = `${repositoryId}-${algo.name}-${filePath}-noop`;

    await prisma.cryptoAsset.upsert({
      where: { repositoryId_fingerprint: { repositoryId, fingerprint } },
      create: {
        repositoryId,
        fingerprint,
        kind: "ALGORITHM",
        name: algo.name,
        primitive: algo.primitive,
        algorithm: algo.name,
        keyLengthBits: algo.key,
        mode: algo.mode ?? null,
        quantumSafe: algo.qs,
        executionEnvironment: "software-plain-ram",
        filePath,
        usageCount: 1,
        firstSeenScanId: scanId,
        lastSeenScanId: scanId,
        riskAssessment: {
          create: {
            crsfScore: algo.crsf,
            cisScore: 100 - algo.crsf,
            pqcSafetyScore: algo.pqc,
            riskCategory: algo.crsf >= 70 ? "CRITICAL" : algo.crsf >= 45 ? "HIGH" : algo.crsf >= 20 ? "MODERATE" : "SAFE",
          },
        },
      },
      update: {
        lastSeenScanId: scanId,
        usageCount: { increment: 1 },
      },
    });
    assetsWritten++;
  }

  await appendLog(scanId, "INFO", `[noop-scanner] Wrote ${assetsWritten} crypto assets`);
  await appendLog(scanId, "INFO", "[noop-scanner] Running detector: findings");

  // Write 0–2 findings
  const numFindings = Math.floor(Math.random() * 3);
  let findingsWritten = 0;
  for (let i = 0; i < numFindings; i++) {
    const tmpl = pick(NOOP_FINDINGS);
    await prisma.finding.create({
      data: {
        repositoryId,
        code: tmpl.code,
        severity: tmpl.severity,
        title: tmpl.title,
        detail: tmpl.detail,
        status: "OPEN",
        affectedComponent: "noop-scanner",
        firstSeenScanId: scanId,
        lastSeenScanId: scanId,
      },
    });
    findingsWritten++;
  }

  await appendLog(scanId, "INFO", `[noop-scanner] Wrote ${findingsWritten} findings`);
  await appendLog(scanId, "INFO", "[noop-scanner] Scan complete");
  return { assetsWritten, findingsWritten };
}

async function appendLog(scanId: string, level: "INFO" | "WARN" | "ERROR", message: string) {
  await prisma.scanLog.create({ data: { scanId, level, message } });
}
