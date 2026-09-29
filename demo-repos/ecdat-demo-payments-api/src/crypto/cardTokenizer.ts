/**
 * Card tokenization — encrypts a PAN into an opaque token for storage.
 *
 * ECDAT fixture note: aes-256-cbc is a real, still-classically-strong cipher
 * (256-bit, quantum-vulnerable but not deprecated), planted here as the
 * "reasonable but not best-practice" middle ground — CBC without a MAC
 * rather than GCM. Contrast with cardTokenizer's neighbour, idempotency.ts,
 * which uses genuinely broken MD5.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-cbc";
const KEY = Buffer.from(process.env.CARD_TOKEN_KEY ?? "0".repeat(64), "hex");

export function tokenizeCard(pan: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(pan, "utf8"), cipher.final()]);
  return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
}

export function detokenizeCard(token: string): string {
  const [ivHex, dataHex] = token.split(":");
  const decipher = createDecipheriv(ALGORITHM, KEY, Buffer.from(ivHex, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]).toString("utf8");
}
