/**
 * Stable fingerprint — a hash over rule ID, canonical algorithm name,
 * parameters and file path. The @@unique([repositoryId, fingerprint])
 * index on CryptoAsset is upserted against this on every re-scan:
 * unchanged artefacts get lastSeenScanId bumped instead of duplicated.
 */
import { createHash } from "crypto";

export interface FingerprintInput {
  repositoryId: string;
  ruleId: string;
  canonicalName: string;
  mode?: string;
  keyLengthBits?: number;
  filePath: string;
}

export function fingerprint(input: FingerprintInput): string {
  const parts = [
    input.repositoryId,
    input.ruleId,
    input.canonicalName,
    input.mode ?? "",
    input.keyLengthBits ?? "",
    input.filePath,
  ].join("|");
  return createHash("sha256").update(parts).digest("hex");
}
