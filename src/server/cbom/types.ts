/**
 * CycloneDX 1.6 types — Phase 4, Step 6.
 *
 * Only the subset of the CycloneDX 1.6 JSON schema this project actually
 * emits is modelled here. The full official schema (vendored at
 * src/server/cbom/schema/bom-1.6.schema.json) is the source of truth for
 * validation — see validate.ts. These types exist purely to keep build.ts
 * type-safe while constructing that subset.
 *
 * Intentionally NOT modelled (omitted, not accidentally missing):
 *   - licenses, externalReferences, evidence, pedigree, hashes, purl/cpe
 *   - services, compositions, vulnerabilities, formulation, declarations,
 *     annotations, signature — entire top-level BOM sections we never emit
 *   - certificateProperties / relatedCryptoMaterialProperties /
 *     protocolProperties — see build.ts's mapping-function comment for why
 *   - metadata.tools / metadata.authors / metadata.component
 */

/** The exact CycloneDX 1.6 cryptoProperties.assetType values this project emits. */
export type CdxCryptoAssetType = "algorithm" | "certificate" | "related-crypto-material" | "protocol";

/** Subset of the official algorithmProperties enum values this project can produce. */
export type CdxAlgorithmPrimitive =
  | "mac"
  | "block-cipher"
  | "stream-cipher"
  | "signature"
  | "hash"
  | "pke"
  | "kdf"
  | "key-agree"
  | "ae"
  | "other"
  | "unknown";

export type CdxAlgorithmMode = "cbc" | "ecb" | "ccm" | "gcm" | "cfb" | "ofb" | "ctr" | "other" | "unknown";

export type CdxExecutionEnvironment =
  | "software-plain-ram"
  | "software-encrypted-ram"
  | "software-tee"
  | "hardware"
  | "other"
  | "unknown";

/** cryptoProperties.algorithmProperties — additionalProperties:false in the official schema; only emit these. */
export interface CdxAlgorithmProperties {
  primitive?: CdxAlgorithmPrimitive;
  parameterSetIdentifier?: string; // schema type is STRING, not integer
  curve?: string;
  executionEnvironment?: CdxExecutionEnvironment;
  mode?: CdxAlgorithmMode;
  classicalSecurityLevel?: number;
  /** 0-6; 0 = "none of the categories are met". Omitted entirely when unknown — see build.ts. */
  nistQuantumSecurityLevel?: number;
}

export interface CdxCryptoProperties {
  assetType: CdxCryptoAssetType;
  algorithmProperties?: CdxAlgorithmProperties;
}

/** Generic CycloneDX {name, value} extension property — the schema's own documented escape hatch. */
export interface CdxProperty {
  name: string;
  value: string;
}

export type CdxComponentType = "cryptographic-asset" | "library";

export interface CdxComponent {
  type: CdxComponentType;
  "bom-ref": string;
  name: string;
  version?: string;
  cryptoProperties?: CdxCryptoProperties;
  properties?: CdxProperty[];
}

export interface CdxDependency {
  ref: string;
  /**
   * Always empty: ECDAT does not currently track cross-component
   * dependency edges (which library depends on which algorithm, etc.).
   * Every component still gets its own dependency entry so the graph is
   * complete (no implicit "unknown dependencies" per the schema's own
   * recommendation), just with no known edges yet.
   */
  dependsOn: string[];
}

export interface CdxMetadata {
  /** Scan.completedAt — never a freshly generated "now" timestamp. */
  timestamp: string;
}

export interface CycloneDxBom {
  bomFormat: "CycloneDX";
  specVersion: "1.6";
  serialNumber: string;
  version: number;
  metadata: CdxMetadata;
  components: CdxComponent[];
  dependencies: CdxDependency[];
}
