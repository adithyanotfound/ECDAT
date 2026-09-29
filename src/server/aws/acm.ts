/**
 * AWS ACM scanner — discovers certificates managed by AWS Certificate Manager
 * and converts them into NormalizedHit objects (CERTIFICATE kind) for the
 * ECDAT crypto-asset pipeline.
 *
 * Uses @aws-sdk/client-acm v3 (latest modular SDK).
 */
import {
  ACMClient,
  ListCertificatesCommand,
  DescribeCertificateCommand,
  CertificateDetail,
  CertificateStatus,
} from "@aws-sdk/client-acm";
import type { NormalizedHit } from "@/server/engine/types";
import { fingerprint } from "@/server/engine/fingerprint";
import type { AwsCredentials } from "./kms";

/**
 * Maps ACM key algorithm to ECDAT vocabulary.
 */
function classifyAcmAlgorithm(algo: string | undefined): {
  algorithm: string;
  keyLengthBits: number | undefined;
  curve: string | undefined;
  quantumSafe: boolean;
  nistQuantumLevel: number;
} {
  if (!algo) return { algorithm: "UNKNOWN", keyLengthBits: undefined, curve: undefined, quantumSafe: false, nistQuantumLevel: 0 };

  // RSA
  if (algo === "RSA_1024") return { algorithm: "RSA-1024", keyLengthBits: 1024, curve: undefined, quantumSafe: false, nistQuantumLevel: 0 };
  if (algo === "RSA_2048") return { algorithm: "RSA-2048", keyLengthBits: 2048, curve: undefined, quantumSafe: false, nistQuantumLevel: 0 };
  if (algo === "RSA_3072") return { algorithm: "RSA-3072", keyLengthBits: 3072, curve: undefined, quantumSafe: false, nistQuantumLevel: 0 };
  if (algo === "RSA_4096") return { algorithm: "RSA-4096", keyLengthBits: 4096, curve: undefined, quantumSafe: false, nistQuantumLevel: 0 };

  // ECDSA
  if (algo === "EC_prime256v1") return { algorithm: "ECDSA", keyLengthBits: 256, curve: "P-256", quantumSafe: false, nistQuantumLevel: 0 };
  if (algo === "EC_secp384r1") return { algorithm: "ECDSA", keyLengthBits: 384, curve: "P-384", quantumSafe: false, nistQuantumLevel: 0 };
  if (algo === "EC_secp521r1") return { algorithm: "ECDSA", keyLengthBits: 521, curve: "P-521", quantumSafe: false, nistQuantumLevel: 0 };

  return { algorithm: algo, keyLengthBits: undefined, curve: undefined, quantumSafe: false, nistQuantumLevel: 0 };
}

function daysUntil(date: Date | undefined): number | null {
  if (!date) return null;
  return Math.floor((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

/**
 * Scans all ACM certificates in the region. Returns NormalizedHit objects.
 * Severity: CRITICAL if expired, HIGH if weak algorithm or expiring <30 days.
 */
export async function scanAcm(
  repositoryId: string,
  creds: AwsCredentials,
  log: (level: "INFO" | "WARN" | "ERROR", message: string) => void
): Promise<NormalizedHit[]> {
  const client = new ACMClient({
    region: creds.region,
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
    },
  });

  log("INFO", `[AWS ACM] Listing certificates in region ${creds.region}`);
  const hits: NormalizedHit[] = [];

  // Step 1: list all certificate ARNs (all statuses except EXPIRED by default — we want EXPIRED too)
  const arns: string[] = [];
  let nextToken: string | undefined;
  do {
    const resp = await client.send(
      new ListCertificatesCommand({
        NextToken: nextToken,
        MaxItems: 100,
        // Include all statuses so we catch expired certs too
        Includes: {
          keyTypes: [
            "RSA_1024", "RSA_2048", "RSA_3072", "RSA_4096",
            "EC_prime256v1", "EC_secp384r1", "EC_secp521r1",
          ],
        },
      })
    );
    for (const cert of resp.CertificateSummaryList ?? []) {
      if (cert.CertificateArn) arns.push(cert.CertificateArn);
    }
    nextToken = resp.NextToken;
  } while (nextToken);

  log("INFO", `[AWS ACM] Found ${arns.length} certificate(s)`);

  // Step 2: describe each cert
  for (const arn of arns) {
    let detail: CertificateDetail | undefined;
    try {
      const resp = await client.send(new DescribeCertificateCommand({ CertificateArn: arn }));
      detail = resp.Certificate;
    } catch (err) {
      log("WARN", `[AWS ACM] Could not describe cert ${arn}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }
    if (!detail) continue;

    const classification = classifyAcmAlgorithm(detail.KeyAlgorithm);
    const filePath = `aws://acm/${creds.region}/${arn.split("/").pop()}`;
    const daysLeft = daysUntil(detail.NotAfter);
    const isExpired = detail.Status === ("EXPIRED" as CertificateStatus) || (daysLeft !== null && daysLeft < 0);
    const isExpiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30;
    const isWeakAlgo = ["RSA-1024", "ECDSA"].includes(classification.algorithm) && (classification.keyLengthBits ?? 9999) < 2048;

    // Determine severity
    let severity: "CRITICAL" | "HIGH" | "MODERATE" | "LOW" | undefined;
    if (isExpired) severity = "CRITICAL";
    else if (isExpiringSoon || isWeakAlgo) severity = "HIGH";
    else if (!classification.quantumSafe) severity = "MODERATE";

    const domain = detail.DomainName ?? arn;
    const canonicalName = `AWS ACM: ${domain} (${classification.algorithm})`;

    const raw = {
      ruleId: "aws.acm.certificate",
      pack: "certificates" as const,
      kind: "CERTIFICATE" as const,
      rawName: detail.KeyAlgorithm ?? "UNKNOWN",
      ...classification,
      primitive: "X.509",
      filePath,
      evidence: [
        `ACM Certificate for ${domain}`,
        `Algorithm: ${classification.algorithm}`,
        detail.NotAfter ? `Expires: ${detail.NotAfter.toISOString()} (${daysLeft !== null ? `${daysLeft} days` : "unknown"})` : "Expiry: unknown",
        `Status: ${detail.Status ?? "UNKNOWN"}`,
        `Type: ${detail.Type ?? "UNKNOWN"}`,
      ].join(" | "),
      confidence: 1,
      severity,
    };

    const fp = fingerprint({
      repositoryId,
      ruleId: raw.ruleId,
      canonicalName,
      keyLengthBits: classification.keyLengthBits,
      filePath,
    });

    hits.push({
      ...raw,
      canonicalName,
      fingerprint: fp,
    });
  }

  log("INFO", `[AWS ACM] Produced ${hits.length} certificate hit(s)`);
  return hits;
}
