/**
 * The real detector pipeline (Phase 4 replaces the Phase 3 no-op placeholder).
 *
 * Checks out the pushed commit via tarball, runs the discovery engine over
 * it, normalises + scores every hit, upserts CryptoAsset/RiskAssessment/
 * Finding rows against the [repositoryId, fingerprint] constraint so re-scans
 * diff instead of duplicate, regenerates PQC recommendations, builds and
 * persists a CycloneDX 1.6 CBOM, and — for push-triggered scans — posts a
 * GitHub Check Run with the verdict.
 *
 * Temp-directory cleanup is guaranteed via try/finally (§Phase 5 "Hardening":
 * "a failed scan must not leak a checkout").
 */
import { prisma } from "@/server/db/client";
import { checkoutTarball } from "@/server/github/tarball";
import { checkoutAws } from "@/server/aws/adapter";
import { scanKms } from "@/server/aws/kms";
import { scanAcm } from "@/server/aws/acm";
import { resolveSecretKey } from "@/server/aws/credentials";
import { postScanCheckRun } from "@/server/github/checks";
import { runEngine } from "@/server/engine/scan";
import type { NormalizedHit, ScanProfileConfig } from "@/server/engine/types";
import { DEFAULT_PROFILE } from "@/server/engine/types";
import { computeCrsf, computeCis, computePqcSafety, computeMosca, riskCategoryFromCrsf } from "@/server/engine/scoring";
import { getRecommendation } from "@/server/engine/recommendations";
import { buildCbom, validateCbom, type CbomAssetInput } from "@/server/engine/cbom";
import { logScan } from "@/lib/logger";
import type { ScanJobPayload } from "./queue";

export async function runScanner(
  scanId: string,
  repositoryId: string,
  payload: ScanJobPayload
): Promise<{ assetsWritten: number; findingsWritten: number; filesScanned: number }> {
  const scan = await prisma.scan.findUniqueOrThrow({
    where: { id: scanId },
    include: { profile: true },
  });
  const repo = await prisma.repository.findUniqueOrThrow({ where: { id: repositoryId } });

  const profileConfig: Partial<ScanProfileConfig> = scan.profile
    ? {
        includeGlobs: DEFAULT_PROFILE.includeGlobs,
        excludeGlobs: [...DEFAULT_PROFILE.excludeGlobs, ...(scan.profile.excludeGlobs.length ? scan.profile.excludeGlobs : [])],
        maxFileSizeKb: scan.profile.maxFileSizeKb,
        rulePackIds: scan.profile.rulePackIds.length ? scan.profile.rulePackIds : DEFAULT_PROFILE.rulePackIds,
      }
    : {};

  const isAws = repo.sourceType === "AWS";

  // ── Source checkout ──────────────────────────────────────────────────────────
  let checkout;
  if (isAws) {
    if (!repo.awsAccessKey || !repo.awsSecretKey || !repo.awsRegion) {
      throw new Error("AWS repository is missing credentials (awsAccessKey, awsSecretKey, awsRegion)");
    }
    const awsCreds = {
      accessKeyId: repo.awsAccessKey,
      secretAccessKey: resolveSecretKey(repo.awsSecretKey),
      region: repo.awsRegion,
    };
    await appendLog(scanId, "INFO", `[AWS] Fetching ${repo.name} from AWS (${repo.awsRegion})`);
    checkout = await checkoutAws(
      awsCreds,
      repo.name,
      payload.ref.replace(/^refs\/heads\//, "") || repo.defaultBranch,
      (level, message) => void appendLog(scanId, level, message)
    );
  } else {
    await appendLog(scanId, "INFO", `Fetching ${payload.owner}/${payload.repo}@${payload.ref} tarball`);
    const gitRef = payload.ref.replace(/^refs\/heads\//, "");
    checkout = await checkoutTarball(payload.installationId, payload.owner, payload.repo, gitRef || payload.commitSha);
  }

  // ── AWS cloud-native asset scans (KMS + ACM) ────────────────────────────────
  // These run in parallel with the code scan hits and get injected into the
  // same result set — their NormalizedHit objects pass through the identical
  // CRSF scoring and upsert pipeline as code-level detections.
  let awsHits: NormalizedHit[] = [];
  if (isAws && repo.awsAccessKey && repo.awsSecretKey && repo.awsRegion) {
    const awsCreds = {
      accessKeyId: repo.awsAccessKey,
      secretAccessKey: resolveSecretKey(repo.awsSecretKey),
      region: repo.awsRegion,
    };
    const logFn = (level: "INFO" | "WARN" | "ERROR", message: string) => {
      logScan(scanId, level, message, { repositoryId });
      void appendLog(scanId, level, message);
    };
    const [kmsHits, acmHits] = await Promise.allSettled([
      scanKms(repositoryId, awsCreds, logFn),
      scanAcm(repositoryId, awsCreds, logFn),
    ]);
    if (kmsHits.status === "fulfilled") awsHits = awsHits.concat(kmsHits.value);
    else await appendLog(scanId, "WARN", `KMS scan failed: ${kmsHits.reason instanceof Error ? kmsHits.reason.message : String(kmsHits.reason)}`);
    if (acmHits.status === "fulfilled") awsHits = awsHits.concat(acmHits.value);
    else await appendLog(scanId, "WARN", `ACM scan failed: ${acmHits.reason instanceof Error ? acmHits.reason.message : String(acmHits.reason)}`);
    await appendLog(scanId, "INFO", `[AWS] Cloud-native hits: ${awsHits.length} (KMS + ACM)`);
  }

  try {
    await appendLog(scanId, "INFO", `Checked out to ${checkout.dir}`);

    const result = await runEngine(repositoryId, checkout.dir, profileConfig, (level, message) => {
      logScan(scanId, level, message, { repositoryId });
      void appendLog(scanId, level, message);
    });

    // Merge AWS cloud-native hits with code-scan hits
    const allHits: NormalizedHit[] = [...result.hits, ...awsHits];
    await appendLog(scanId, "INFO", `Upserting ${allHits.length} crypto assets (${result.hits.length} code + ${awsHits.length} AWS cloud)`);

    let assetsWritten = 0;
    let findingsWritten = 0;
    let quantumVulnerableCount = 0;

    for (const hit of allHits) {
      const existing = await prisma.cryptoAsset.findUnique({
        where: { repositoryId_fingerprint: { repositoryId, fingerprint: hit.fingerprint } },
        select: { id: true, usageCount: true },
      });
      const usageCount = (existing?.usageCount ?? 0) + 1;

      const crsfScore = computeCrsf(hit, { usageCount, criticality: repo.criticality });
      const { score: cisScore, explanation: cisExplanation } = computeCis(hit, crsfScore);
      const pqcSafetyScore = computePqcSafety(hit);
      const riskCategory = riskCategoryFromCrsf(crsfScore);

      const mosca = computeMosca({
        dataLifetimeYears: repo.dataLifetimeYears,
        quantumVulnerableCount: hit.quantumSafe === false ? 1 : 0,
        totalAssetCount: allHits.length,
      });

      const assetData = {
        kind: hit.kind,
        name: hit.canonicalName,
        primitive: hit.primitive ?? null,
        algorithm: hit.algorithm ?? null,
        keyLengthBits: hit.keyLengthBits ?? null,
        mode: hit.mode ?? null,
        padding: hit.padding ?? null,
        curve: hit.curve ?? null,
        nistQuantumLevel: hit.nistQuantumLevel ?? null,
        quantumSafe: hit.quantumSafe ?? null,
        executionEnvironment: hit.executionEnvironment ?? null,
        classicalSecLevel: hit.classicalSecLevel ?? null,
        filePath: hit.filePath,
        lineNumber: hit.lineNumber ?? null,
        ruleId: hit.ruleId,
      };

      const asset = await prisma.cryptoAsset.upsert({
        where: { repositoryId_fingerprint: { repositoryId, fingerprint: hit.fingerprint } },
        create: {
          repositoryId,
          fingerprint: hit.fingerprint,
          ...assetData,
          usageCount: 1,
          firstSeenScanId: scanId,
          lastSeenScanId: scanId,
          riskAssessment: {
            create: {
              crsfScore,
              cisScore,
              pqcSafetyScore,
              riskCategory,
              moscaX: mosca.x,
              moscaY: mosca.y,
              moscaZ: mosca.z,
              moscaVerdict: mosca.verdict,
              cisExplanation,
            },
          },
        },
        update: {
          ...assetData,
          usageCount,
          lastSeenScanId: scanId,
          riskAssessment: {
            upsert: {
              create: {
                crsfScore,
                cisScore,
                pqcSafetyScore,
                riskCategory,
                moscaX: mosca.x,
                moscaY: mosca.y,
                moscaZ: mosca.z,
                moscaVerdict: mosca.verdict,
                cisExplanation,
              },
              update: {
                crsfScore,
                cisScore,
                pqcSafetyScore,
                riskCategory,
                moscaX: mosca.x,
                moscaY: mosca.y,
                moscaZ: mosca.z,
                moscaVerdict: mosca.verdict,
                cisExplanation,
              },
            },
          },
        },
      });
      assetsWritten++;

      if (hit.quantumSafe === false) {
        quantumVulnerableCount++;
      }

      // A detector can assert severity directly (disabled TLS verification, a
      // hardcoded key, JWT alg=none). Everything else still becomes a Finding
      // when its computed CRSF risk category lands at CRITICAL/HIGH — a bare
      // MD5 or 3DES call site is a vulnerability even though no single rule
      // hand-labelled it one. Library/dependency inventory is excluded: an
      // old package being *present* isn't itself a discrete finding here.
      const findingSeverity =
        hit.severity ??
        (hit.kind !== "LIBRARY" && (riskCategory === "CRITICAL" || riskCategory === "HIGH")
          ? riskCategory
          : undefined);

      if (findingSeverity) {
        const findingCode = hit.ruleId.toUpperCase().replace(/\./g, "-");
        const existingFinding = await prisma.finding.findFirst({
          where: { repositoryId, code: findingCode, filePath: hit.filePath },
          select: { id: true },
        });

        const findingData = {
          severity: findingSeverity,
          title: findingTitle(hit),
          detail: hit.evidence,
          remediation: getRecommendation(hit)?.notes ?? null,
          cweId: hit.cweId ?? null,
          nistRef: hit.nistRef ?? null,
          affectedComponent: hit.canonicalName,
          filePath: hit.filePath,
          lineNumber: hit.lineNumber ?? null,
          lastSeenScanId: scanId,
          lastSeenAt: new Date(),
        };

        const finding = existingFinding
          ? await prisma.finding.update({ where: { id: existingFinding.id }, data: findingData })
          : await prisma.finding.create({
              data: { repositoryId, code: findingCode, firstSeenScanId: scanId, ...findingData },
            });

        await prisma.findingAsset.upsert({
          where: { findingId_cryptoAssetId: { findingId: finding.id, cryptoAssetId: asset.id } },
          create: { findingId: finding.id, cryptoAssetId: asset.id },
          update: {},
        });
        findingsWritten++;
      }
    }

    await appendLog(scanId, "INFO", `Wrote ${assetsWritten} crypto assets, ${findingsWritten} findings`);

    // ── Recommendations — regenerate fresh from this scan's quantum-vulnerable canon names ──
    await appendLog(scanId, "INFO", "Regenerating PQC recommendations");
    await prisma.recommendation.deleteMany({ where: { repositoryId } });
    const recoRows = dedupeRecommendations(allHits);
    if (recoRows.length) {
      await prisma.recommendation.createMany({
        data: recoRows.map((r) => ({ repositoryId, ...r })),
      });
    }

    // ── CBOM — build from the full current inventory, not just this scan's hits ──
    await appendLog(scanId, "INFO", "Building CycloneDX 1.6 CBOM");
    const allAssets = await prisma.cryptoAsset.findMany({ where: { repositoryId } });
    const cbomAssets: CbomAssetInput[] = allAssets.map((a) => ({
      id: a.id,
      kind: a.kind,
      name: a.name,
      primitive: a.primitive,
      mode: a.mode,
      padding: a.padding,
      keyLengthBits: a.keyLengthBits,
      curve: a.curve,
      nistQuantumLevel: a.nistQuantumLevel,
      classicalSecLevel: a.classicalSecLevel,
      executionEnvironment: a.executionEnvironment,
      filePath: a.filePath,
      usageCount: a.usageCount,
      lastSeenAt: a.updatedAt.toISOString(),
    }));
    const cbom = buildCbom({
      repositoryFullName: repo.fullName,
      commitSha: payload.commitSha,
      scanId,
      assets: cbomAssets,
    });
    const validation = validateCbom(cbom);
    if (!validation.valid) {
      await appendLog(scanId, "WARN", `CBOM failed structural validation: ${validation.errors.slice(0, 3).join("; ")}`);
    } else {
      // Round-trip through JSON to strip `undefined` fields before handing to Prisma's Json column.
      const cbomJson = JSON.parse(JSON.stringify(cbom));
      await prisma.cbom.upsert({
        where: { scanId },
        create: { scanId, spec: "1.6", json: cbomJson },
        update: { spec: "1.6", json: cbomJson },
      });
      await appendLog(scanId, "INFO", `CBOM persisted with ${cbom.components.length} components`);
    }

    // ── Optional GitHub Check Run — push-triggered scans only ──
    if (scan.trigger === "PUSH" && payload.installationId) {
      const newCritical = await prisma.finding.count({
        where: { repositoryId, firstSeenScanId: scanId, severity: "CRITICAL" },
      });
      const newHigh = await prisma.finding.count({
        where: { repositoryId, firstSeenScanId: scanId, severity: "HIGH" },
      });
      await postScanCheckRun({
        owner: payload.owner,
        repo: payload.repo,
        commitSha: payload.commitSha,
        installationId: payload.installationId,
        newCriticalCount: newCritical,
        newHighCount: newHigh,
        totalAssets: allAssets.length,
        quantumVulnerableCount,
      });
      await appendLog(scanId, "INFO", "Posted GitHub Check Run");
    }

    await appendLog(scanId, "INFO", `Scan complete${result.truncated ? " (truncated by scan caps)" : ""}`);
    return { assetsWritten, findingsWritten, filesScanned: result.filesScanned };
  } finally {
    await checkout.cleanup();
    await appendLog(scanId, "DEBUG", "Temp checkout cleaned up");
  }
}

function findingTitle(hit: NormalizedHit): string {
  if (hit.canonicalName === "JWT alg=none") return "JWT signature verification disabled (alg=none)";
  if (hit.kind === "PROTOCOL") return `Weak protocol configuration: ${hit.canonicalName}`;
  if (hit.kind === "SECRET") return hit.canonicalName;
  if (hit.kind === "CERTIFICATE") return `Certificate risk: ${hit.canonicalName}`;
  if (hit.kind === "KEY") return hit.canonicalName;
  return `Weak or deprecated algorithm in use: ${hit.canonicalName}`;
}

function dedupeRecommendations(hits: NormalizedHit[]) {
  const seen = new Map<string, ReturnType<typeof getRecommendation>>();
  for (const hit of hits) {
    const reco = getRecommendation(hit);
    if (reco && !seen.has(reco.fromAlgorithm)) seen.set(reco.fromAlgorithm, reco);
  }
  return [...seen.values()].filter((r): r is NonNullable<typeof r> => r !== null);
}

async function appendLog(scanId: string, level: "DEBUG" | "INFO" | "WARN" | "ERROR", message: string) {
  await prisma.scanLog.create({ data: { scanId, level, message } }).catch(() => {});
}
