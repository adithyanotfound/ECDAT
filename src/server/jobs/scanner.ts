/**
 * Scanner entry point.
 *
 * Phase 4, Step 1 made the first real operation a repository checkout:
 * fetchRepoTarball() downloads and securely extracts the tarball for the
 * scanned commit into a temp directory before anything else runs, and that
 * directory is always cleaned up afterwards regardless of scan outcome.
 *
 * Phase 4, Step 2 replaced the old no-op placeholder with the real JS/TS
 * cryptographic call-site detector, running against the checked-out tree.
 *
 * Phase 4, Step 3 added the npm manifest/dependency crypto-library detector
 * alongside it (additive — the Step 2 detector is unchanged).
 *
 * Phase 4, Step 4 adds the certificate/key detector (standalone
 * .pem/.crt/.cer/.der/.key/.p12/.pfx/.jks files only).
 *
 * Phase 4, Step 5 adds the risk scoring pass, run once after all three
 * detectors, over the union of CryptoAsset IDs they touched this scan.
 * Scoring never rescans the repository's entire historical asset
 * inventory — only what changed/was seen in this pass.
 */
import { rm } from "node:fs/promises";
import { prisma } from "@/server/db/client";
import { fetchRepoTarball } from "./checkout";
import { runJsTsCryptoDetector } from "@/server/detectors/js-crypto-detector";
import { runManifestDetector } from "@/server/detectors/manifest-detector";
import { runCertKeyDetector } from "@/server/detectors/certkey-detector";
import { runScoringPass } from "@/server/scoring/engine";
import type { ScanJobPayload } from "./queue";

export async function runScanner(
  payload: ScanJobPayload
): Promise<{ assetsWritten: number; findingsWritten: number }> {
  const { scanId, repositoryId, owner, repo, ref } = payload;

  const { dir, fileCount, skippedFileCount } = await fetchRepoTarball(payload, (level, message) =>
    appendLog(scanId, level, message)
  );

  await appendLog(scanId, "INFO", `[scanner] fetched ${fileCount} files for ${owner}/${repo}@${ref}`);
  if (skippedFileCount > 0) {
    await appendLog(
      scanId,
      "INFO",
      `[scanner] skipped ${skippedFileCount} files because they exceeded the file-size limit`
    );
  }

  try {
    // ── JS/TS call-site detector (Phase 4, Step 2) ─────────────────────────
    await appendLog(scanId, "INFO", "[scanner] starting JS/TS crypto detection");

    const jsResult = await runJsTsCryptoDetector({
      dir,
      repositoryId,
      scanId,
      onLog: (level, message) => appendLog(scanId, level, message),
    });

    await appendLog(scanId, "INFO", `[scanner] scanned ${jsResult.filesScanned} JS/TS files`);
    if (jsResult.filesSkipped > 0) {
      await appendLog(
        scanId,
        "INFO",
        `[scanner] skipped ${jsResult.filesSkipped} JS/TS files because they exceeded the detector size limit`
      );
    }
    await appendLog(scanId, "INFO", `[scanner] detected ${jsResult.detectionsFound} crypto call sites`);
    await appendLog(scanId, "INFO", `[scanner] upserted ${jsResult.assetsUpserted} crypto assets`);

    // ── npm manifest/dependency detector (Phase 4, Step 3) ─────────────────
    await appendLog(scanId, "INFO", "[scanner] starting npm manifest crypto-library detection");

    const manifestResult = await runManifestDetector({
      dir,
      repositoryId,
      scanId,
      onLog: (level, message) => appendLog(scanId, level, message),
    });

    await appendLog(scanId, "INFO", `[manifest] found ${manifestResult.manifestsScanned} package.json manifests`);
    if (manifestResult.manifestsSkipped > 0) {
      await appendLog(
        scanId,
        "INFO",
        `[manifest] skipped ${manifestResult.manifestsSkipped} malformed or unreadable manifests`
      );
    }
    await appendLog(scanId, "INFO", `[manifest] matched ${manifestResult.librariesMatched} known crypto libraries`);
    await appendLog(scanId, "INFO", `[manifest] upserted ${manifestResult.assetsUpserted} crypto assets`);

    // ── certificate/key detector (Phase 4, Step 4) ─────────────────────────
    await appendLog(scanId, "INFO", "[scanner] starting certificate/key detection");

    const certKeyResult = await runCertKeyDetector({
      dir,
      repositoryId,
      scanId,
      onLog: (level, message) => appendLog(scanId, level, message),
    });

    await appendLog(scanId, "INFO", `[certkey] scanned ${certKeyResult.filesScanned} certificate/key files`);
    if (certKeyResult.filesSkipped > 0) {
      await appendLog(
        scanId,
        "INFO",
        `[certkey] skipped ${certKeyResult.filesSkipped} files because they exceeded the size limit or could not be read`
      );
    }
    await appendLog(scanId, "INFO", `[certkey] found ${certKeyResult.certificatesFound} certificates`);
    await appendLog(scanId, "INFO", `[certkey] found ${certKeyResult.keysFound} keys`);
    if (certKeyResult.unparsedBundlesFound > 0) {
      await appendLog(scanId, "INFO", `[certkey] found ${certKeyResult.unparsedBundlesFound} unparsed PKCS#12/JKS bundles`);
    }
    await appendLog(scanId, "INFO", `[certkey] upserted ${certKeyResult.assetsUpserted} crypto assets`);

    // ── risk scoring pass (Phase 4, Step 5) ────────────────────────────────
    // Union + dedupe every asset touched by the three detectors above, then
    // score exactly once — never the repository's full historical inventory.
    const scoredAssetIds = [
      ...new Set([...jsResult.assetIds, ...manifestResult.assetIds, ...certKeyResult.assetIds]),
    ];

    await appendLog(scanId, "INFO", "[scanner] starting risk scoring pass");

    await runScoringPass({
      repositoryId,
      scanId,
      assetIds: scoredAssetIds,
      onLog: (level, message) => appendLog(scanId, level, message),
    });

    await appendLog(scanId, "INFO", "[scanner] Scan complete");

    // Finding generation is not implemented yet — Steps 2-4 are CryptoAsset
    // discovery only, and Step 5 is risk scoring only. Finding/CBOM
    // generation are later phases.
    return {
      assetsWritten: jsResult.assetsUpserted + manifestResult.assetsUpserted + certKeyResult.assetsUpserted,
      findingsWritten: 0,
    };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function appendLog(scanId: string, level: "INFO" | "WARN" | "ERROR", message: string) {
  await prisma.scanLog.create({ data: { scanId, level, message } });
}
