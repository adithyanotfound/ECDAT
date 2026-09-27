/**
 * AWS KMS scanner — discovers Customer-Managed Keys (CMKs) in a region
 * and converts them into NormalizedHit objects that feed directly into the
 * main ECDAT crypto-asset pipeline.
 *
 * Uses @aws-sdk/client-kms v3 (latest modular SDK, no deprecated patterns).
 */
import {
  KMSClient,
  ListKeysCommand,
  DescribeKeyCommand,
  KeyMetadata,
  ListAliasesCommand,
} from "@aws-sdk/client-kms";
import type { NormalizedHit } from "@/server/engine/types";
import { fingerprint } from "@/server/engine/fingerprint";

export interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

/**
 * Maps a KMS key spec to ECDAT vocabulary fields.
 * AWS key spec strings: https://docs.aws.amazon.com/kms/latest/developerguide/asymmetric-key-specs.html
 */
function classifyKeySpec(spec: string | undefined): {
  algorithm: string;
  primitive: string;
  keyLengthBits: number | undefined;
  curve: string | undefined;
  quantumSafe: boolean;
  nistQuantumLevel: number;
} {
  if (!spec) return { algorithm: "UNKNOWN", primitive: "KEY", keyLengthBits: undefined, curve: undefined, quantumSafe: false, nistQuantumLevel: 0 };

  // Symmetric AES
  if (spec === "SYMMETRIC_DEFAULT") return { algorithm: "AES-256", primitive: "SYMMETRIC_ENCRYPTION", keyLengthBits: 256, curve: undefined, quantumSafe: true, nistQuantumLevel: 1 };
  if (spec === "HMAC_224") return { algorithm: "HMAC-SHA2-224", primitive: "MAC", keyLengthBits: 224, curve: undefined, quantumSafe: true, nistQuantumLevel: 1 };
  if (spec === "HMAC_256") return { algorithm: "HMAC-SHA2-256", primitive: "MAC", keyLengthBits: 256, curve: undefined, quantumSafe: true, nistQuantumLevel: 1 };
  if (spec === "HMAC_384") return { algorithm: "HMAC-SHA2-384", primitive: "MAC", keyLengthBits: 384, curve: undefined, quantumSafe: true, nistQuantumLevel: 1 };
  if (spec === "HMAC_512") return { algorithm: "HMAC-SHA2-512", primitive: "MAC", keyLengthBits: 512, curve: undefined, quantumSafe: true, nistQuantumLevel: 1 };

  // RSA
  if (spec === "RSA_2048") return { algorithm: "RSA-2048", primitive: "ASYMMETRIC_ENCRYPTION", keyLengthBits: 2048, curve: undefined, quantumSafe: false, nistQuantumLevel: 0 };
  if (spec === "RSA_3072") return { algorithm: "RSA-3072", primitive: "ASYMMETRIC_ENCRYPTION", keyLengthBits: 3072, curve: undefined, quantumSafe: false, nistQuantumLevel: 0 };
  if (spec === "RSA_4096") return { algorithm: "RSA-4096", primitive: "ASYMMETRIC_ENCRYPTION", keyLengthBits: 4096, curve: undefined, quantumSafe: false, nistQuantumLevel: 0 };

  // ECC
  if (spec === "ECC_NIST_P256") return { algorithm: "ECDSA", primitive: "ASYMMETRIC_SIGNATURE", keyLengthBits: 256, curve: "P-256", quantumSafe: false, nistQuantumLevel: 0 };
  if (spec === "ECC_NIST_P384") return { algorithm: "ECDSA", primitive: "ASYMMETRIC_SIGNATURE", keyLengthBits: 384, curve: "P-384", quantumSafe: false, nistQuantumLevel: 0 };
  if (spec === "ECC_NIST_P521") return { algorithm: "ECDSA", primitive: "ASYMMETRIC_SIGNATURE", keyLengthBits: 521, curve: "P-521", quantumSafe: false, nistQuantumLevel: 0 };
  if (spec === "ECC_SECG_P256K1") return { algorithm: "ECDSA", primitive: "ASYMMETRIC_SIGNATURE", keyLengthBits: 256, curve: "secp256k1", quantumSafe: false, nistQuantumLevel: 0 };

  // SM (China standard)
  if (spec === "SM2") return { algorithm: "SM2", primitive: "ASYMMETRIC_SIGNATURE", keyLengthBits: 256, curve: "SM2", quantumSafe: false, nistQuantumLevel: 0 };

  // MLKEM / ML-DSA (post-quantum — future KMS support)
  if (spec.startsWith("ML_KEM")) return { algorithm: spec, primitive: "KEY_ENCAPSULATION", keyLengthBits: undefined, curve: undefined, quantumSafe: true, nistQuantumLevel: 1 };
  if (spec.startsWith("ML_DSA")) return { algorithm: spec, primitive: "ASYMMETRIC_SIGNATURE", keyLengthBits: undefined, curve: undefined, quantumSafe: true, nistQuantumLevel: 1 };

  return { algorithm: spec, primitive: "KEY", keyLengthBits: undefined, curve: undefined, quantumSafe: false, nistQuantumLevel: 0 };
}

/**
 * Lists all enabled CMKs in the AWS region and returns NormalizedHit objects.
 * AWS-managed keys (aws/*) are included but not customer-managed.
 */
export async function scanKms(
  repositoryId: string,
  creds: AwsCredentials,
  log: (level: "INFO" | "WARN" | "ERROR", message: string) => void
): Promise<NormalizedHit[]> {
  const client = new KMSClient({
    region: creds.region,
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
    },
  });

  log("INFO", `[AWS KMS] Listing keys in region ${creds.region}`);
  const hits: NormalizedHit[] = [];

  // Step 1: list all key IDs
  const keyIds: string[] = [];
  let marker: string | undefined;
  do {
    const resp = await client.send(new ListKeysCommand({ Marker: marker, Limit: 100 }));
    for (const k of resp.Keys ?? []) {
      if (k.KeyId) keyIds.push(k.KeyId);
    }
    marker = resp.NextMarker;
  } while (marker);

  log("INFO", `[AWS KMS] Found ${keyIds.length} key(s)`);

  // Step 2: fetch aliases for display names
  const aliasMap = new Map<string, string>();
  let aliasMarker: string | undefined;
  do {
    const resp = await client.send(new ListAliasesCommand({ Marker: aliasMarker, Limit: 100 }));
    for (const a of resp.Aliases ?? []) {
      if (a.TargetKeyId && a.AliasName) aliasMap.set(a.TargetKeyId, a.AliasName);
    }
    aliasMarker = resp.NextMarker;
  } while (aliasMarker);

  // Step 3: describe each key and build hits
  for (const keyId of keyIds) {
    let meta: KeyMetadata | undefined;
    try {
      const resp = await client.send(new DescribeKeyCommand({ KeyId: keyId }));
      meta = resp.KeyMetadata;
    } catch (err) {
      log("WARN", `[AWS KMS] Could not describe key ${keyId}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    if (!meta) continue;
    // Skip pending-deletion or disabled keys — they're not active crypto assets
    if (meta.KeyState === "PendingDeletion" || meta.KeyState === "Disabled") continue;

    const alias = aliasMap.get(keyId) ?? keyId;
    const classification = classifyKeySpec(meta.KeySpec);
    const filePath = `aws://kms/${creds.region}/${keyId}`;

    const raw = {
      ruleId: "aws.kms.cmk",
      pack: "keys" as const,
      kind: "KEY" as const,
      rawName: meta.KeySpec ?? "UNKNOWN",
      ...classification,
      filePath,
      evidence: `AWS KMS Key: ${alias} (${meta.KeySpec}) — Usage: ${meta.KeyUsage ?? "UNKNOWN"} — State: ${meta.KeyState ?? "UNKNOWN"}`,
      confidence: 1,
    };

    const normalized: NormalizedHit = {
      ...raw,
      canonicalName: `AWS KMS: ${alias} (${classification.algorithm})`,
      fingerprint: fingerprint({
        repositoryId,
        ruleId: raw.ruleId,
        canonicalName: `AWS KMS: ${alias} (${classification.algorithm})`,
        mode: undefined,
        keyLengthBits: classification.keyLengthBits,
        filePath,
      }),
    };
    hits.push(normalized);
  }

  log("INFO", `[AWS KMS] Produced ${hits.length} KMS key hit(s)`);
  return hits;
}
