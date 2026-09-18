/**
 * Configuration/protocol detector persistence — Phase 5, Step 8.
 *
 * Pipeline: discover nginx/sshd_config/Terraform files -> parse directives ->
 * normalise -> fingerprint (all in config-protocol-scan.ts, pure and
 * DB-free) -> upsert CryptoAsset (here). Mirrors certkey-detector.ts /
 * js-crypto-detector.ts / manifest-detector.ts exactly, including the same
 * `(repositoryId, fingerprint)` upsert discipline — an unchanged directive
 * value keeps the same CryptoAsset row across rescans.
 *
 * Deliberately does not create RiskAssessment or Finding rows — that's
 * scoring/findings' job, run later in the same scan (see scanner.ts and
 * src/server/findings/derive.ts's PROTOCOL-kind branch).
 */
import { prisma } from "@/server/db/client";
import { scanConfigProtocolFiles, type ConfigProtocolDetection } from "./config-protocol-scan";
import type { DetectorLogger } from "./js-crypto-scan";

export interface RunConfigProtocolDetectorOptions {
  /** The checked-out repository root, as returned by fetchRepoTarball(). */
  dir: string;
  repositoryId: string;
  scanId: string;
  onLog?: DetectorLogger;
}

export interface ConfigProtocolDetectorResult {
  filesScanned: number;
  filesSkipped: number;
  directivesFound: number;
  assetsUpserted: number;
  /** CryptoAsset IDs touched this scan — feeds the risk scoring pass. */
  assetIds: string[];
}

async function upsertConfigProtocolAsset(params: {
  repositoryId: string;
  scanId: string;
  detection: ConfigProtocolDetection;
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
      // incremented against prior scans — mirrors every other detector's
      // convention. firstSeenScanId is preserved by omission.
      usageCount: occurrences,
      lastSeenScanId: scanId,
    },
    select: { id: true },
  });

  return asset.id;
}

export async function runConfigProtocolDetector(
  options: RunConfigProtocolDetectorOptions
): Promise<ConfigProtocolDetectorResult> {
  const { dir, repositoryId, scanId } = options;
  const onLog: DetectorLogger = options.onLog ?? (() => {});

  const { detections, filesScanned, filesSkipped } = await scanConfigProtocolFiles(dir, onLog);

  const byFingerprint = new Map<string, { detection: ConfigProtocolDetection; occurrences: number }>();
  for (const detection of detections) {
    const existing = byFingerprint.get(detection.fingerprint);
    if (existing) {
      existing.occurrences++;
    } else {
      byFingerprint.set(detection.fingerprint, { detection, occurrences: 1 });
    }
  }

  const assetIds: string[] = [];
  for (const { detection, occurrences } of byFingerprint.values()) {
    const id = await upsertConfigProtocolAsset({ repositoryId, scanId, detection, occurrences });
    assetIds.push(id);
  }

  let directivesFound = 0;
  for (const { occurrences } of byFingerprint.values()) directivesFound += occurrences;

  return { filesScanned, filesSkipped, directivesFound, assetsUpserted: assetIds.length, assetIds };
}
