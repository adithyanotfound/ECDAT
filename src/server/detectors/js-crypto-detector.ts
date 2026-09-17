/**
 * JS/TS cryptographic call-site detector — Phase 4, Step 2.
 *
 * Pipeline: discover files -> read each once -> apply applicable rules ->
 * normalise -> fingerprint (all in js-crypto-scan.ts, pure and DB-free) ->
 * upsert CryptoAsset (here). Keeping persistence in its own module means the
 * matching engine can be unit-tested without a database connection.
 *
 * Deliberately does not create RiskAssessment rows, compute CRSF/PQC scores,
 * or write Findings — that's later work. A CryptoAsset with no
 * RiskAssessment is the correct, expected state after this step.
 */
import { prisma } from "@/server/db/client";
import { discoverSourceFiles, readSourceFile, scanSourceForCryptoUsage, type CryptoDetection, type DetectorLogger } from "./js-crypto-scan";

export interface RunJsTsCryptoDetectorOptions {
  /** The checked-out repository root, as returned by fetchRepoTarball(). */
  dir: string;
  repositoryId: string;
  scanId: string;
  onLog?: DetectorLogger;
}

export interface JsCryptoDetectorResult {
  filesScanned: number;
  filesSkipped: number;
  detectionsFound: number;
  assetsUpserted: number;
  /** CryptoAsset IDs touched this scan — feeds the Phase 4, Step 5 scoring pass. */
  assetIds: string[];
}

async function upsertCryptoAsset(params: {
  repositoryId: string;
  scanId: string;
  detection: CryptoDetection;
  occurrences: number;
}): Promise<string> {
  const { repositoryId, scanId, detection, occurrences } = params;
  const { usage, fingerprint, ruleId, relativeFilePath, lineNumber } = detection;

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
      lineNumber,
      usageCount: occurrences,
      firstSeenScanId: scanId,
      lastSeenScanId: scanId,
    },
    update: {
      ...shared,
      // Recomputed deterministically from this scan's content, not
      // incremented against prior scans — rescanning unchanged code must
      // not inflate usageCount, and firstSeenScanId is preserved by omission.
      usageCount: occurrences,
      lastSeenScanId: scanId,
    },
    select: { id: true },
  });

  return asset.id;
}

export async function runJsTsCryptoDetector(
  options: RunJsTsCryptoDetectorOptions
): Promise<JsCryptoDetectorResult> {
  const { dir, repositoryId, scanId } = options;
  const onLog: DetectorLogger = options.onLog ?? (() => {});

  const relativeFiles = await discoverSourceFiles(dir);

  let filesScanned = 0;
  let filesSkipped = 0;
  const byFingerprint = new Map<string, { detection: CryptoDetection; occurrences: number }>();

  for (const relPath of relativeFiles) {
    const content = await readSourceFile(dir, relPath, onLog);
    if (content === null) {
      filesSkipped++;
      continue;
    }
    filesScanned++;

    let detections: CryptoDetection[];
    try {
      detections = scanSourceForCryptoUsage(content, relPath);
    } catch (err) {
      // A malformed individual file must not abort the whole repository scan.
      await onLog(
        "WARN",
        `[js-crypto] failed to analyze ${relPath}: ${err instanceof Error ? err.message : String(err)}`
      );
      continue;
    }

    for (const detection of detections) {
      const existing = byFingerprint.get(detection.fingerprint);
      if (existing) {
        existing.occurrences++;
      } else {
        byFingerprint.set(detection.fingerprint, { detection, occurrences: 1 });
      }
    }
  }

  let detectionsFound = 0;
  for (const { occurrences } of byFingerprint.values()) {
    detectionsFound += occurrences;
  }

  const assetIds: string[] = [];
  for (const { detection, occurrences } of byFingerprint.values()) {
    const id = await upsertCryptoAsset({ repositoryId, scanId, detection, occurrences });
    assetIds.push(id);
  }

  return { filesScanned, filesSkipped, detectionsFound, assetsUpserted: assetIds.length, assetIds };
}
