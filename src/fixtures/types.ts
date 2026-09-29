// ─── Shared enums ────────────────────────────────────────────────────────────

export type Severity = "Critical" | "High" | "Moderate" | "Low" | "Compliant";
export type ScanStatus = "Completed" | "Running" | "Failed" | "Queued";
export type Trigger = "INITIAL" | "PUSH" | "MANUAL";
export type PqcSafety = "Yes" | "No" | "Medium" | "Upgrade to PQC";
export type CryptoKind =
  | "Algorithm"
  | "Certificate"
  | "Key"
  | "Protocol"
  | "Library"
  | "Secret";

// ─── Repository ───────────────────────────────────────────────────────────────

export interface Repository {
  id: string;
  fullName: string;
  owner: string;
  name: string;
  defaultBranch: string;
  lastCommitSha: string;
  language: string;
  connectedAt: string;
  scanEnabled: boolean;
  dataLifetimeYears: number;
  criticality: "Critical" | "High" | "Medium" | "Low";
  lastScanAt: string | null;
  lastScanStatus: ScanStatus | null;
}

// ─── Scan ─────────────────────────────────────────────────────────────────────

export interface Scan {
  id: string;
  repositoryId: string;
  repositoryFullName: string;
  trigger: Trigger;
  status: ScanStatus;
  commitSha: string;
  ref: string;
  durationMs: number | null;
  filesScanned: number | null;
  startedAt: string;
  completedAt: string | null;
  profileName: string;
}

// ─── ScanProfile ──────────────────────────────────────────────────────────────

export interface ScanProfile {
  id: string;
  name: string;
  rulePackIds: string[];
  includeGlobs: string[];
  excludeGlobs: string[];
  maxFileSizeKb: number;
  createdAt: string;
  isDefault: boolean;
}

// ─── CryptoAsset ──────────────────────────────────────────────────────────────

export interface CryptoAsset {
  id: string;
  repositoryId: string;
  repositoryFullName?: string;
  kind: CryptoKind;
  name: string;
  primitive?: string;
  algorithm?: string;
  keyLengthBits?: number;
  mode?: string;
  curve?: string;
  quantumSafe: boolean | null;
  executionEnvironment?: string;
  filePath: string;
  usageCount: number;
  dependencies: number;
  lastSeenAt: string;
  crsfScore: number;
  pqcSafetyScore: number;
  severity: Severity;
  // Mosca's inequality — X (data lifetime) + Y (migration time) > Z (time to CRQC)
  moscaX?: number;
  moscaY?: number;
  moscaZ?: number;
  moscaVerdict?: "ACT_NOW" | "PLAN" | "SAFE";
}

// ─── Finding / Vulnerability ───────────────────────────────────────────────────

export interface Finding {
  id: string;
  code: string;
  repositoryId: string;
  repositoryFullName: string;
  severity: Severity;
  title: string;
  detail: string;
  affectedComponent: string;
  filePath: string;
  status: "Open" | "Mitigated" | "Accepted";
  firstSeenAt: string;
  lastSeenAt: string;
}

// ─── Dashboard aggregates ─────────────────────────────────────────────────────

export interface DashboardAggregates {
  quantumReadinessScore: number;
  cryptographicAssetsCount: number;
  repositoriesScanned: number;
  vulnerableAssetsPercent: number;
  highRiskAssets: number;
  vulnerabilitiesBySource: VulnBySource[];
  cryptographicPosture: PostureBreakdown;
  assetsByType: AssetByType[];
  symmetricKeyDistribution: KeyDistribution[];
  asymmetricKeyDistribution: KeyDistribution[];
}

export interface VulnBySource {
  source: string;
  critical: number;
  high: number;
  moderate: number;
  low: number;
}

export interface PostureBreakdown {
  high: number;
  medium: number;
  low: number;
  compliant: number;
}

export interface AssetByType {
  type: string;
  count: number;
}

export interface KeyDistribution {
  name: string;
  percent: number;
}

// ─── PQC Report ───────────────────────────────────────────────────────────────

export interface PqcReport {
  repositoryId: string;
  repositoryFullName: string;
  pqcScore: number;
  quantumVulnerableCount: number;
  pqcReadyCount: number;
  lastScannedAt: string;
}

// ─── Inventory Asset ──────────────────────────────────────────────────────────

export interface InventoryAsset {
  id: string;
  assetId: string;
  lastDiscovered: string;
  ipHostname: string;
  ports: string;
  serviceTag: string;
  classified: boolean;
  deepDiscovery: boolean;
  lastScanned: string;
}
