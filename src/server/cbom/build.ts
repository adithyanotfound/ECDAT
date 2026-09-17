/**
 * CycloneDX 1.6 CBOM builder — Phase 4, Step 6.
 *
 * Pure: no Prisma, no I/O, no database. Takes already-fetched data and
 * returns a CycloneDX document, so it's directly unit-testable with
 * hand-constructed fixtures (build.test.ts) without DATABASE_URL — mirrors
 * the detectors' "pure scan module" half. fetch.ts is the thin
 * Prisma-fetching wrapper (the other half); persist.ts layers validation
 * and storage on top of that.
 *
 * CURRENT INVENTORY (see fetch.ts): reuses the exact definition already
 * used by src/server/db/assets.ts's getCryptoAssetsPage — every CryptoAsset
 * row for the repository, full stop (no firstSeenScanId/lastSeenScanId
 * filtering). This project has no historical/point-in-time snapshotting: a
 * CryptoAsset row is upserted in place and always reflects the latest scan
 * that saw it, so "current inventory as of scan X" and "current inventory
 * right now" are the same query.
 */
import { createHash } from "node:crypto";
import type {
  CdxAlgorithmMode,
  CdxAlgorithmPrimitive,
  CdxAlgorithmProperties,
  CdxComponent,
  CdxComponentType,
  CdxCryptoAssetType,
  CdxDependency,
  CdxExecutionEnvironment,
  CdxProperty,
  CycloneDxBom,
} from "./types";

// ─── Deterministic serial number (RFC 4122 UUIDv5, no external `uuid` dep) ──

/**
 * Fixed, arbitrary namespace UUID for ECDAT CBOM serial numbers — generated
 * once (crypto.randomUUID()) and hardcoded forever after, per the standard
 * UUIDv5 pattern for a private namespace. Never regenerate this: doing so
 * would change every previously-generated scan's serialNumber.
 */
const CBOM_SERIAL_NAMESPACE = "d7f6e6c2-4b8f-5e21-9a3e-6c2f0a7e9b41";

/** RFC 4122 UUIDv5 (namespace + name, SHA-1) — deterministic, no Math.random()/Date.now(). */
export function uuidV5(name: string, namespace: string): string {
  const namespaceBytes = Buffer.from(namespace.replace(/-/g, ""), "hex");
  const nameBytes = Buffer.from(name, "utf8");
  const hash = createHash("sha1").update(Buffer.concat([namespaceBytes, nameBytes])).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function serialNumberForScan(scanId: string): string {
  return `urn:uuid:${uuidV5(scanId, CBOM_SERIAL_NAMESPACE)}`;
}

// ─── Input shape (pure — no Prisma types leak in) ──────────────────────────

export type BuildCbomAssetKind = "ALGORITHM" | "CERTIFICATE" | "KEY" | "PROTOCOL" | "LIBRARY" | "SECRET";

export interface BuildCbomRiskAssessment {
  crsfScore: number;
  pqcSafetyScore: number;
  riskCategory: string;
  moscaVerdict: string;
}

export interface BuildCbomAsset {
  fingerprint: string;
  kind: BuildCbomAssetKind;
  name: string;
  primitive: string | null;
  keyLengthBits: number | null;
  curve: string | null;
  mode: string | null;
  quantumSafe: boolean | null;
  executionEnvironment: string | null;
  classicalSecLevel: number | null;
  usageCount: number;
  riskAssessment: BuildCbomRiskAssessment | null;
}

export interface BuildCbomInput {
  scanId: string;
  /** Scan.completedAt — required; a CBOM only makes sense for a completed scan. */
  completedAt: Date;
  assets: BuildCbomAsset[];
}

// ─── CryptoAsset.kind -> CycloneDX component/assetType mapping ─────────────

/**
 * ALGORITHM/CERTIFICATE/KEY/PROTOCOL/SECRET all become a
 * `type: "cryptographic-asset"` component; LIBRARY becomes a plain
 * `type: "library"` component with no cryptoProperties — a library is not
 * itself a cryptographic primitive.
 */
function mapComponentType(kind: BuildCbomAssetKind): CdxComponentType {
  return kind === "LIBRARY" ? "library" : "cryptographic-asset";
}

/**
 * cryptoProperties.assetType per kind, per the task's authoritative
 * mapping. SECRET has no explicit instruction (no secrets detector exists
 * yet to ever produce one) — "related-crypto-material" is the closest fit
 * in the official enum (its own values include password/credential/token).
 */
function mapAssetType(kind: BuildCbomAssetKind): CdxCryptoAssetType {
  switch (kind) {
    case "ALGORITHM":
      return "algorithm";
    case "CERTIFICATE":
      return "certificate";
    case "KEY":
      return "related-crypto-material";
    case "PROTOCOL":
      return "protocol";
    case "SECRET":
      return "related-crypto-material";
    case "LIBRARY":
      // Unreachable: mapComponentType routes LIBRARY away before this is called.
      throw new Error("LIBRARY assets do not have a cryptoProperties.assetType");
  }
}

// ─── algorithmProperties field mappers ─────────────────────────────────────
//
// NOTE ON certificateProperties / relatedCryptoMaterialProperties /
// protocolProperties: the official CycloneDX 1.6 schema defines these as
// alternatives to algorithmProperties for CERTIFICATE/KEY/PROTOCOL assets
// (e.g. a certificate's subject/issuer/validity dates). This project does
// not persist that metadata on CryptoAsset (the certificate/key detector's
// pure scanner extracts it, but Step 4 never added DB columns for it — see
// certkey-detector.ts). What IS persisted for every kind — algorithm,
// keyLengthBits, curve, executionEnvironment, quantumSafe — is genuinely
// available, so algorithmProperties is populated for every
// cryptographic-asset regardless of assetType, and the other three
// properties objects are intentionally left unpopulated rather than
// fabricated.

/** Internal CryptoAsset.primitive strings (see detectors/normalize.ts) -> the official enum's closest member. */
const PRIMITIVE_MAP: Record<string, CdxAlgorithmPrimitive> = {
  hash: "hash",
  mac: "mac",
  "block-cipher": "block-cipher",
  "stream-cipher": "stream-cipher",
  "aead-cipher": "ae",
  signature: "signature",
  "key-exchange": "key-agree",
  kdf: "kdf",
  encryption: "pke",
  "key-wrap": "other",
  cipher: "other",
};

function mapPrimitive(primitive: string | null): CdxAlgorithmPrimitive | undefined {
  if (primitive == null) return undefined;
  return PRIMITIVE_MAP[primitive] ?? "unknown";
}

const VALID_MODES = new Set(["cbc", "ecb", "ccm", "gcm", "cfb", "ofb", "ctr"]);

function mapMode(mode: string | null): CdxAlgorithmMode | undefined {
  if (mode == null) return undefined;
  const lower = mode.toLowerCase();
  return (VALID_MODES.has(lower) ? lower : "other") as CdxAlgorithmMode;
}

const VALID_EXECUTION_ENVIRONMENTS = new Set([
  "software-plain-ram",
  "software-encrypted-ram",
  "software-tee",
  "hardware",
  "other",
  "unknown",
]);

function mapExecutionEnvironment(env: string | null): CdxExecutionEnvironment {
  // "unknown" is the schema's own designated sentinel for "not known" on
  // this enum field, so using it here is not a fabrication.
  if (env == null) return "unknown";
  return (VALID_EXECUTION_ENVIRONMENTS.has(env) ? env : "unknown") as CdxExecutionEnvironment;
}

/**
 * nistQuantumSecurityLevel — deliberately derived from CryptoAsset.quantumSafe,
 * never from RiskAssessment.nistQuantumLevel (which the scoring engine, Step 5,
 * always leaves null). Required mapping per the task spec:
 *   quantumSafe === true  -> 1 (lowest non-zero category; a documented
 *                            placeholder — this project doesn't track which
 *                            specific NIST PQC category an algorithm meets)
 *   quantumSafe === false -> 0 ("none of the categories are met", exactly
 *                            what the official schema defines 0 to mean)
 *   quantumSafe === null  -> omitted entirely. Unlike the enum fields above,
 *                            this is a plain 0-6 integer with no "unknown"
 *                            sentinel value, so the only non-fabricating,
 *                            schema-valid way to express "we don't know" is
 *                            to leave the optional field out.
 */
const NIST_QUANTUM_LEVEL_SAFE_PLACEHOLDER = 1;
const NIST_QUANTUM_LEVEL_NOT_SAFE = 0;

function mapNistQuantumSecurityLevel(quantumSafe: boolean | null): number | undefined {
  if (quantumSafe === true) return NIST_QUANTUM_LEVEL_SAFE_PLACEHOLDER;
  if (quantumSafe === false) return NIST_QUANTUM_LEVEL_NOT_SAFE;
  return undefined;
}

function buildAlgorithmProperties(asset: BuildCbomAsset): CdxAlgorithmProperties {
  const props: CdxAlgorithmProperties = {};

  const primitive = mapPrimitive(asset.primitive);
  if (primitive) props.primitive = primitive;

  // parameterSetIdentifier is a STRING in the official schema, not an integer.
  if (asset.keyLengthBits != null) props.parameterSetIdentifier = String(asset.keyLengthBits);

  if (asset.curve != null) props.curve = asset.curve;

  const mode = mapMode(asset.mode);
  if (mode) props.mode = mode;

  props.executionEnvironment = mapExecutionEnvironment(asset.executionEnvironment);

  if (asset.classicalSecLevel != null) props.classicalSecurityLevel = asset.classicalSecLevel;

  const nistLevel = mapNistQuantumSecurityLevel(asset.quantumSafe);
  if (nistLevel !== undefined) props.nistQuantumSecurityLevel = nistLevel;

  return props;
}

// ─── Extension properties (usageCount + RiskAssessment) ────────────────────
//
// usageCount has no home in the official algorithmProperties object (it has
// additionalProperties:false and no such field — confirmed against the
// vendored schema). The task's literal instruction to map it to
// `cryptoProperties.algorithmProperties.usageCount` would make every CBOM
// containing it schema-invalid, which conflicts with this step's own "hard
// requirement" that generated CBOMs validate against the real CycloneDX 1.6
// schema. Schema validity wins: usageCount (and, where available, the
// RiskAssessment scores this generator consumes but never (re)calculates)
// are carried instead as standard CycloneDX `properties[]` {name, value}
// extension entries — the schema's own documented mechanism for exactly
// this kind of tool-specific data, namespaced "ecdat:" to avoid collisions.

function buildProperties(asset: BuildCbomAsset): CdxProperty[] {
  const properties: CdxProperty[] = [{ name: "ecdat:usageCount", value: String(asset.usageCount) }];

  if (asset.riskAssessment) {
    properties.push(
      { name: "ecdat:crsfScore", value: String(asset.riskAssessment.crsfScore) },
      { name: "ecdat:pqcSafetyScore", value: String(asset.riskAssessment.pqcSafetyScore) },
      { name: "ecdat:riskCategory", value: asset.riskAssessment.riskCategory },
      { name: "ecdat:moscaVerdict", value: asset.riskAssessment.moscaVerdict }
    );
  }

  return properties;
}

// ─── Component + dependency assembly ───────────────────────────────────────

function buildComponent(asset: BuildCbomAsset): CdxComponent {
  const componentType = mapComponentType(asset.kind);

  const component: CdxComponent = {
    type: componentType,
    // The fingerprint is already unique per (repositoryId, fingerprint), and
    // every asset in one CBOM shares the same repository, so it's a stable,
    // deterministic, collision-free bom-ref with no extra bookkeeping.
    "bom-ref": asset.fingerprint,
    name: asset.name,
    properties: buildProperties(asset),
  };

  if (componentType === "cryptographic-asset") {
    component.cryptoProperties = {
      assetType: mapAssetType(asset.kind),
      algorithmProperties: buildAlgorithmProperties(asset),
    };
  }

  return component;
}

function buildDependencies(components: CdxComponent[]): CdxDependency[] {
  // Known simplification: ECDAT does not currently track cross-component
  // dependency edges (e.g. "this library implements that algorithm"), so
  // every component gets its own entry with an empty dependsOn — a complete
  // graph with no known edges yet, rather than omitting entries (which the
  // schema says implies "unknown dependencies").
  return components.map((component) => ({ ref: component["bom-ref"], dependsOn: [] }));
}

// ─── Pure builder ───────────────────────────────────────────────────────────

export function buildCbom(input: BuildCbomInput): CycloneDxBom {
  const components = input.assets.map(buildComponent);
  const dependencies = buildDependencies(components);

  return {
    bomFormat: "CycloneDX",
    specVersion: "1.6",
    serialNumber: serialNumberForScan(input.scanId),
    version: 1,
    metadata: { timestamp: input.completedAt.toISOString() },
    components,
    dependencies,
  };
}

