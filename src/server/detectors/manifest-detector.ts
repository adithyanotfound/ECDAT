/**
 * npm manifest/dependency crypto-library detector — Phase 4, Step 3.
 *
 * Pipeline: discover package.json files -> parse dependencies/devDependencies
 * -> match against the known-crypto-libs catalogue -> resolve version from
 * the adjacent package-lock.json (or fall back to the manifest range) -> all
 * in manifest-scan.ts, pure and DB-free -> upsert CryptoAsset (here).
 *
 * Additive to the Phase 4, Step 2 JS/TS call-site detector: same repository
 * checkout, same scan, produces `kind: "LIBRARY"` rows alongside its
 * `kind: "ALGORITHM"` rows. Does not touch that detector's rules, matching,
 * fingerprinting, or persistence.
 *
 * Deliberately does not create RiskAssessment rows or compute any scoring —
 * that's later work.
 *
 * VERSION STORAGE NOTE: the pure scanner resolves an exact `resolvedVersion`
 * (from the lockfile) or a version range (from the manifest) for every
 * match, but CryptoAsset has no field intended to hold a library version —
 * every nullable String column (`primitive`, `algorithm`, `mode`, `padding`,
 * `curve`, `executionEnvironment`) already has its own distinct, narrower
 * cryptographic meaning, and repurposing any of them for a version string
 * would be misleading to anyone reading that column for its intended
 * purpose. Per instructions, no schema change/migration was made this step,
 * so `resolvedVersion`/`versionSource` are surfaced only via `onLog` below —
 * not persisted to any CryptoAsset column. See the Step 3 implementation
 * report for the explicit STOP/report on this point.
 */
import { prisma } from "@/server/db/client";
import { scanManifestsForCryptoLibraries, type ManifestDetection } from "./manifest-scan";
import type { DetectorLogger } from "./js-crypto-scan";

export interface RunManifestDetectorOptions {
  /** The checked-out repository root, as returned by fetchRepoTarball(). */
  dir: string;
  repositoryId: string;
  scanId: string;
  onLog?: DetectorLogger;
}

export interface ManifestDetectorResult {
  manifestsScanned: number;
  manifestsSkipped: number;
  librariesMatched: number;
  assetsUpserted: number;
  /** CryptoAsset IDs touched this scan — feeds the Phase 4, Step 5 scoring pass. */
  assetIds: string[];
}

async function upsertLibraryAsset(params: {
  repositoryId: string;
  scanId: string;
  detection: ManifestDetection;
  occurrences: number;
}): Promise<string> {
  const { repositoryId, scanId, detection, occurrences } = params;
  const { usage, fingerprint, ruleId, manifestPath } = detection;

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
      filePath: manifestPath,
      lineNumber: null,
      usageCount: occurrences,
      firstSeenScanId: scanId,
      lastSeenScanId: scanId,
    },
    update: {
      ...shared,
      // Recomputed deterministically from this scan's content, not
      // incremented against prior scans — mirrors the Phase 4 Step 2
      // convention exactly. firstSeenScanId is preserved by omission.
      usageCount: occurrences,
      lastSeenScanId: scanId,
    },
    select: { id: true },
  });

  return asset.id;
}

export async function runManifestDetector(options: RunManifestDetectorOptions): Promise<ManifestDetectorResult> {
  const { dir, repositoryId, scanId } = options;
  const onLog: DetectorLogger = options.onLog ?? (() => {});

  const { detections, manifestsScanned, manifestsSkipped } = await scanManifestsForCryptoLibraries(dir, onLog);

  const byFingerprint = new Map<string, { detection: ManifestDetection; occurrences: number }>();
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
    const id = await upsertLibraryAsset({ repositoryId, scanId, detection, occurrences });
    assetIds.push(id);
    await onLog(
      "INFO",
      `[manifest] ${detection.packageName}@${detection.resolvedVersion} (${detection.versionSource}) in ${detection.manifestPath}`
    );
  }

  return {
    manifestsScanned,
    manifestsSkipped,
    librariesMatched: byFingerprint.size,
    assetsUpserted: assetIds.length,
    assetIds,
  };
}
