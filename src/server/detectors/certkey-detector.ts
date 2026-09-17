/**
 * Certificate & key detector persistence — Phase 4, Step 4.
 *
 * Pipeline: discover cert/key files -> parse each (PEM/DER certificates,
 * PEM private keys, unparsed PKCS#12/JKS placeholders) -> normalise ->
 * fingerprint (all in certkey-scan.ts, pure and DB-free) -> upsert
 * CryptoAsset (here). Mirrors js-crypto-detector.ts and manifest-detector.ts.
 *
 * Deliberately does not create RiskAssessment rows or certificate-expiry
 * Findings — that's later work (scoring is Phase 4, Step 5, run
 * separately by scanner.ts after this detector).
 *
 * FINGERPRINT / CERTIFICATE RENEWAL NOTE (Option A, per task spec §A12):
 * the fingerprint intentionally excludes the certificate serial number.
 * A certificate renewed in place (new serial, same algorithm/key/file
 * location) updates the existing CryptoAsset rather than creating a
 * second one — the same continuity convention already used for manifest
 * library version bumps in Step 3 (a version change there doesn't create
 * a new asset either). If a future phase wants "true renewal = new
 * asset" semantics, switch to Option B by folding `usage.serialNumber`
 * into the fingerprint in certkey-scan.ts.
 */
import { prisma } from "@/server/db/client";
import { scanCertKeyFiles, type CertKeyDetection } from "./certkey-scan";
import type { DetectorLogger } from "./js-crypto-scan";

export interface RunCertKeyDetectorOptions {
  /** The checked-out repository root, as returned by fetchRepoTarball(). */
  dir: string;
  repositoryId: string;
  scanId: string;
  onLog?: DetectorLogger;
}

export interface CertKeyDetectorResult {
  filesScanned: number;
  filesSkipped: number;
  certificatesFound: number;
  keysFound: number;
  unparsedBundlesFound: number;
  assetsUpserted: number;
  /** CryptoAsset IDs touched this scan — feeds the Step 5 scoring pass. */
  assetIds: string[];
}

async function upsertCertKeyAsset(params: {
  repositoryId: string;
  scanId: string;
  detection: CertKeyDetection;
  occurrences: number;
}): Promise<string> {
  const { repositoryId, scanId, detection, occurrences } = params;
  const { usage, fingerprint, ruleId, relativeFilePath } = detection;

  const shared = {
    kind: usage.kind,
    name: usage.name,
    primitive: usage.primitive ?? null,
    algorithm: usage.algorithm ?? null,
    keyLengthBits: usage.keyLengthBits ?? null,
    mode: usage.mode ?? null,
    padding: usage.padding ?? null,
    curve: usage.curve ?? null,
    nistQuantumLevel: usage.nistQuantumLevel ?? null,
    quantumSafe: usage.quantumSafe ?? null,
    executionEnvironment: usage.executionEnvironment ?? null,
    classicalSecLevel: usage.classicalSecLevel ?? null,
    ruleId,
  };

  const asset = await prisma.cryptoAsset.upsert({
    where: { repositoryId_fingerprint: { repositoryId, fingerprint } },
    create: {
      ...shared,
      repositoryId,
      fingerprint,
      filePath: relativeFilePath,
      lineNumber: null,
      usageCount: occurrences,
      firstSeenScanId: scanId,
      lastSeenScanId: scanId,
    },
    update: {
      ...shared,
      // Recomputed deterministically from this scan's content, not
      // incremented against prior scans — mirrors the Step 2/3 convention
      // exactly. firstSeenScanId is preserved by omission.
      usageCount: occurrences,
      lastSeenScanId: scanId,
    },
    select: { id: true },
  });

  return asset.id;
}

export async function runCertKeyDetector(options: RunCertKeyDetectorOptions): Promise<CertKeyDetectorResult> {
  const { dir, repositoryId, scanId } = options;
  const onLog: DetectorLogger = options.onLog ?? (() => {});

  const { detections, filesScanned, filesSkipped } = await scanCertKeyFiles(dir, onLog);

  const byFingerprint = new Map<string, { detection: CertKeyDetection; occurrences: number }>();
  for (const detection of detections) {
    const existing = byFingerprint.get(detection.fingerprint);
    if (existing) {
      existing.occurrences++;
    } else {
      byFingerprint.set(detection.fingerprint, { detection, occurrences: 1 });
    }
  }

  let certificatesFound = 0;
  let keysFound = 0;
  let unparsedBundlesFound = 0;
  const assetIds: string[] = [];

  for (const { detection, occurrences } of byFingerprint.values()) {
    const id = await upsertCertKeyAsset({ repositoryId, scanId, detection, occurrences });
    assetIds.push(id);

    if (detection.usage.kind === "CERTIFICATE") {
      certificatesFound++;
    } else if (detection.ruleId === "certkey.p12.unparsed" || detection.ruleId === "certkey.jks.unparsed") {
      unparsedBundlesFound++;
    } else {
      keysFound++;
    }
  }

  return {
    filesScanned,
    filesSkipped,
    certificatesFound,
    keysFound,
    unparsedBundlesFound,
    assetsUpserted: byFingerprint.size,
    assetIds,
  };
}
