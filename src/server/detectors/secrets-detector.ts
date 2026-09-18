/**
 * Entropy-gated secret detector persistence — Phase 5, Step 8.
 *
 * Pipeline: discover source files -> scan for crypto-adjacent hardcoded
 * secrets -> compute a safe representation + fingerprint (all in
 * secrets-scan.ts, pure and DB-free) -> upsert CryptoAsset (here). Mirrors
 * every other detector's "pure module -> persistence module" split.
 *
 * SAFETY: this module only ever receives `SecretDetection.usage.name`
 * (already the safe `SECRET_xxxx_<hash>` representation built in
 * secrets-scan.ts) and `SecretDetection.fingerprint` (a hash, never the raw
 * value). Nothing in this file ever sees, logs, or persists the raw secret
 * — there is no raw value anywhere in this module's scope to leak.
 *
 * Deliberately does not query existing CryptoAsset rows to check for
 * cert/key overlap — PEM material is excluded statelessly, by pattern, in
 * secrets-scan.ts's containsPemMaterial() check, so this detector has no
 * ordering dependency on certkey-detector.ts running first or at all.
 */
import { prisma } from "@/server/db/client";
import { scanFilesForSecrets, type SecretDetection } from "./secrets-scan";
import type { DetectorLogger } from "./js-crypto-scan";

export interface RunSecretsDetectorOptions {
  /** The checked-out repository root, as returned by fetchRepoTarball(). */
  dir: string;
  repositoryId: string;
  scanId: string;
  onLog?: DetectorLogger;
}

export interface SecretsDetectorResult {
  filesScanned: number;
  filesSkipped: number;
  secretsFound: number;
  assetsUpserted: number;
  /** CryptoAsset IDs touched this scan — feeds the risk scoring pass. */
  assetIds: string[];
}

async function upsertSecretAsset(params: {
  repositoryId: string;
  scanId: string;
  detection: SecretDetection;
}): Promise<string> {
  const { repositoryId, scanId, detection } = params;
  const { usage, fingerprint, ruleId, relativeFilePath, lineNumber } = detection;

  // Only the fields that are meaningful for an unknown hardcoded secret —
  // never invent algorithm/keyLength/curve metadata we have no evidence for.
  const shared = {
    kind: usage.kind,
    name: usage.name,
    primitive: null,
    algorithm: null,
    keyLengthBits: null,
    mode: null,
    padding: null,
    curve: null,
    nistQuantumLevel: null,
    quantumSafe: null,
    executionEnvironment: null,
    classicalSecLevel: null,
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
      usageCount: 1,
      firstSeenScanId: scanId,
      lastSeenScanId: scanId,
    },
    update: {
      ...shared,
      lastSeenScanId: scanId,
    },
    select: { id: true },
  });

  return asset.id;
}

export async function runSecretsDetector(options: RunSecretsDetectorOptions): Promise<SecretsDetectorResult> {
  const { dir, repositoryId, scanId } = options;
  const onLog: DetectorLogger = options.onLog ?? (() => {});

  const { detections, filesScanned, filesSkipped } = await scanFilesForSecrets(dir, onLog);

  const assetIds: string[] = [];
  for (const detection of detections) {
    const id = await upsertSecretAsset({ repositoryId, scanId, detection });
    assetIds.push(id);
    // Log only the safe representation and location — never a raw value,
    // which never exists in this module's scope to begin with.
    await onLog("INFO", `[secrets] hardcoded secret ${detection.usage.name} in ${detection.relativeFilePath}:${detection.lineNumber}`);
  }

  return { filesScanned, filesSkipped, secretsFound: detections.length, assetsUpserted: assetIds.length, assetIds };
}
