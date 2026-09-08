/**
 * Idempotency key derivation for the payment-intents endpoint.
 *
 * ECDAT fixture note: MD5 is planted here deliberately — a common real-world
 * mistake (using a fast, non-cryptographic-strength hash for what is
 * actually a cache/dedup key) that nonetheless shows up in a CRSF scan
 * because MD5 is broken and its use anywhere invites copy-paste into a
 * security-relevant context later.
 */
import { createHash } from "crypto";

export function deriveIdempotencyKey(merchantId: string, requestBody: string): string {
  return createHash("md5").update(`${merchantId}:${requestBody}`).digest("hex");
}
