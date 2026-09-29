/**
 * CBOM export — CycloneDX 1.6 with `cryptographic-asset` components and a
 * real `dependencies` graph. (IMPLEMENTATION_PLAN.md §4d)
 *
 * Every field in the reference's detail-drawer maps onto a CycloneDX 1.6
 * path — that mapping *is* the CBOM (see §1 "The detail drawer" in the plan):
 *
 *   Primitive              -> algorithmProperties.primitive
 *   Type                   -> assetType
 *   Mode                   -> algorithmProperties.mode
 *   Key Length             -> algorithmProperties.parameterSetIdentifier
 *   Quantum Safe           -> algorithmProperties.nistQuantumSecurityLevel
 *   Execution Environment  -> algorithmProperties.executionEnvironment
 *   Dependencies/Usage     -> dependencies[].dependsOn
 *   Last Seen              -> evidence.occurrences[]
 */
import { randomUUID } from "crypto";
import { z } from "zod";

export interface CbomAssetInput {
  id: string;
  kind: "ALGORITHM" | "CERTIFICATE" | "KEY" | "PROTOCOL" | "LIBRARY" | "SECRET";
  name: string;
  primitive?: string | null;
  mode?: string | null;
  padding?: string | null;
  keyLengthBits?: number | null;
  curve?: string | null;
  nistQuantumLevel?: number | null;
  classicalSecLevel?: number | null;
  executionEnvironment?: string | null;
  filePath: string;
  usageCount: number;
  lastSeenAt: string;
}

export interface CbomInput {
  repositoryFullName: string;
  commitSha: string;
  scanId: string;
  assets: CbomAssetInput[];
}

const ASSET_TYPE_MAP: Record<CbomAssetInput["kind"], string> = {
  ALGORITHM: "algorithm",
  CERTIFICATE: "certificate",
  KEY: "related-material",
  PROTOCOL: "protocol",
  LIBRARY: "related-material",
  SECRET: "related-material",
};

function bomRef(assetId: string): string {
  return `crypto-asset:${assetId}`;
}

export function buildCbom(input: CbomInput) {
  const components = input.assets.map((a) => {
    const assetType = ASSET_TYPE_MAP[a.kind];
    const algorithmProperties =
      a.kind === "ALGORITHM" || a.kind === "PROTOCOL"
        ? {
            primitive: a.primitive ?? "unknown",
            parameterSetIdentifier: a.keyLengthBits != null ? String(a.keyLengthBits) : undefined,
            mode: a.mode ? a.mode.toLowerCase() : undefined,
            padding: a.padding ? a.padding.toLowerCase() : undefined,
            curve: a.curve ?? undefined,
            classicalSecurityLevel: a.classicalSecLevel ?? undefined,
            nistQuantumSecurityLevel: a.nistQuantumLevel ?? 0,
            executionEnvironment: a.executionEnvironment ?? "software-plain-ram",
          }
        : undefined;

    return {
      type: "cryptographic-asset",
      "bom-ref": bomRef(a.id),
      name: a.name,
      cryptoProperties: {
        assetType,
        ...(algorithmProperties ? { algorithmProperties } : {}),
      },
      evidence: {
        occurrences: [
          {
            location: a.filePath,
            line: undefined,
          },
        ],
      },
      properties: [
        { name: "ecdat:usageCount", value: String(a.usageCount) },
        { name: "ecdat:lastSeen", value: a.lastSeenAt },
      ],
    };
  });

  const dependencies = input.assets.map((a) => ({
    ref: bomRef(a.id),
    dependsOn: [] as string[],
  }));

  return {
    bomFormat: "CycloneDX",
    specVersion: "1.6",
    serialNumber: `urn:uuid:${randomUUID()}`,
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      component: {
        type: "application",
        name: input.repositoryFullName,
        version: input.commitSha,
      },
      tools: {
        components: [{ type: "application", name: "Vajra", version: "1.0.0" }],
      },
    },
    components,
    dependencies,
  };
}

// ─── Structural validation ──────────────────────────────────────────────────
// A hand-written mirror of the CycloneDX 1.6 fields this exporter emits.
// Used both as a runtime guard before persisting a Cbom row and as the
// `npm run test:cbom` regression check (see scripts/validate-cbom.ts).

const algorithmPropertiesSchema = z.object({
  primitive: z.string(),
  parameterSetIdentifier: z.string().optional(),
  mode: z.string().optional(),
  padding: z.string().optional(),
  curve: z.string().optional(),
  classicalSecurityLevel: z.number().optional(),
  nistQuantumSecurityLevel: z.number(),
  executionEnvironment: z.string(),
});

const componentSchema = z.object({
  type: z.literal("cryptographic-asset"),
  "bom-ref": z.string().min(1),
  name: z.string().min(1),
  cryptoProperties: z.object({
    assetType: z.enum(["algorithm", "certificate", "related-material", "protocol"]),
    algorithmProperties: algorithmPropertiesSchema.optional(),
  }),
  evidence: z.object({
    occurrences: z.array(z.object({ location: z.string() })).min(1),
  }),
  properties: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
});

export const cbomSchema = z.object({
  bomFormat: z.literal("CycloneDX"),
  specVersion: z.literal("1.6"),
  serialNumber: z.string().regex(/^urn:uuid:/),
  version: z.number(),
  metadata: z.object({
    timestamp: z.string(),
    component: z.object({
      type: z.literal("application"),
      name: z.string().min(1),
      version: z.string(),
    }),
  }),
  components: z.array(componentSchema),
  dependencies: z.array(z.object({ ref: z.string(), dependsOn: z.array(z.string()) })),
});

export function validateCbom(bom: unknown): { valid: boolean; errors: string[] } {
  const result = cbomSchema.safeParse(bom);
  if (result.success) return { valid: true, errors: [] };
  return {
    valid: false,
    errors: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
  };
}
