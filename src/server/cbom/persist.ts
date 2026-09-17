/**
 * CBOM persistence — Phase 4, Step 6.
 *
 * Thin: builds the CBOM (build.ts), validates it against the real
 * CycloneDX 1.6 schema (validate.ts — cheap insurance against ever
 * persisting a broken CBOM), then upserts the single Cbom row for the
 * scan. Never duplicates rows: `scanId` is unique on Cbom, and every write
 * goes through `prisma.cbom.upsert()`.
 */
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import { buildCbomForScan } from "./fetch";
import { validateCbom } from "./validate";
import type { CycloneDxBom } from "./types";

export interface GenerateAndStoreCbomResult {
  cbom: CycloneDxBom;
  componentCount: number;
}

export async function generateAndStoreCbom(scanId: string): Promise<GenerateAndStoreCbomResult> {
  const cbom = await buildCbomForScan(scanId);

  const { valid, errors } = validateCbom(cbom);
  if (!valid) {
    // A CBOM that fails schema validation is worse than none — refuse to
    // persist it. The caller (worker.ts / the on-demand API route) decides
    // how to log/report this; it must never turn a successful scan FAILED.
    throw new Error(`Generated CBOM failed CycloneDX 1.6 schema validation: ${errors.join("; ")}`);
  }

  const json = cbom as unknown as Prisma.InputJsonValue;

  await prisma.cbom.upsert({
    where: { scanId },
    create: { scanId, spec: "1.6", json },
    update: { spec: "1.6", json },
  });

  return { cbom, componentCount: cbom.components.length };
}
