/**
 * Finding persistence — Phase 5, Step 7.
 *
 * Takes the FindingCandidate[] that src/server/findings/derive.ts produced
 * for every CryptoAsset scored this scan, and makes the Finding/FindingAsset
 * tables match — idempotently, so a rescan of an unchanged repository
 * creates zero duplicate rows.
 *
 * FINDING IDENTITY: (repositoryId, code, triggering cryptoAssetId).
 *
 * CryptoAsset rows are already stable across rescans via the
 * `@@unique([repositoryId, fingerprint])` upsert every detector uses
 * (Phase 2) — an unchanged artefact keeps the same `id` forever, it is
 * never recreated. That means `cryptoAssetId` is exactly as stable an
 * identity component as `fingerprint` would be, without an extra lookup:
 * "the same underlying issue" is "the same rule code applied to the same
 * CryptoAsset row", found via the FindingAsset join.
 */
import { prisma } from "@/server/db/client";
import type { FindingCandidate } from "./derive";

export interface PersistFindingsResult {
  created: number;
  updated: number;
  resolved: number;
}

export async function persistFindings(
  repositoryId: string,
  scanId: string,
  candidates: FindingCandidate[]
): Promise<PersistFindingsResult> {
  let created = 0;
  let updated = 0;
  const now = new Date();
  const activeAssetIds = new Set<string>();

  for (const candidate of candidates) {
    activeAssetIds.add(candidate.cryptoAssetId);

    const existing = await prisma.finding.findFirst({
      where: {
        repositoryId,
        code: candidate.code,
        assets: { some: { cryptoAssetId: candidate.cryptoAssetId } },
      },
      select: { id: true },
    });

    let findingId: string;

    if (existing) {
      // UPDATE: only lastSeenScanId/lastSeenAt move. firstSeenScanId/
      // firstSeenAt are preserved by omission — never touched here.
      await prisma.finding.update({
        where: { id: existing.id },
        data: { lastSeenScanId: scanId, lastSeenAt: now },
      });
      findingId = existing.id;
      updated++;
    } else {
      const finding = await prisma.finding.create({
        data: {
          repositoryId,
          code: candidate.code,
          severity: candidate.severity,
          title: candidate.title,
          detail: candidate.detail,
          remediation: candidate.remediation,
          cweId: candidate.cweId,
          nistRef: candidate.nistRef,
          affectedComponent: candidate.affectedComponent,
          filePath: candidate.filePath,
          lineNumber: candidate.lineNumber,
          status: "OPEN",
          firstSeenScanId: scanId,
          lastSeenScanId: scanId,
          firstSeenAt: now,
          lastSeenAt: now,
        },
        select: { id: true },
      });
      findingId = finding.id;
      created++;
    }

    // Idempotent join row — composite PK means a second upsert for the same
    // (findingId, cryptoAssetId) pair this scan is a no-op, never a duplicate.
    await prisma.findingAsset.upsert({
      where: { findingId_cryptoAssetId: { findingId, cryptoAssetId: candidate.cryptoAssetId } },
      create: { findingId, cryptoAssetId: candidate.cryptoAssetId },
      update: {},
    });
  }

  const resolved = await resolveStaleFindings(repositoryId, activeAssetIds);

  return { created, updated, resolved };
}

/**
 * Marks OPEN findings RESOLVED when every one of their triggering assets is
 * absent from this scan's candidate set — i.e. the asset was removed from
 * the repository, or it no longer trips that particular rule. Scoped to
 * `repositoryId` throughout, so a rescan of one repository never touches
 * another repository's findings. Only ever called after derive.ts finished
 * producing candidates for a successful scoring pass (see engine.ts) — a
 * thrown/failed scan never reaches this function.
 */
async function resolveStaleFindings(repositoryId: string, activeAssetIds: Set<string>): Promise<number> {
  const openFindings = await prisma.finding.findMany({
    where: { repositoryId, status: "OPEN" },
    select: { id: true, assets: { select: { cryptoAssetId: true } } },
  });

  const staleIds = openFindings
    .filter((f) => f.assets.length > 0 && f.assets.every((a) => !activeAssetIds.has(a.cryptoAssetId)))
    .map((f) => f.id);

  if (staleIds.length === 0) return 0;

  const result = await prisma.finding.updateMany({
    where: { id: { in: staleIds } },
    data: { status: "RESOLVED" },
  });

  return result.count;
}
