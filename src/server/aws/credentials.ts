/**
 * Encrypts and decrypts AWS secret keys at rest.
 *
 * Algorithm: AES-256-GCM (built-in Node.js crypto — no extra deps).
 * Key source: CREDENTIAL_ENCRYPTION_KEY env var (64 hex chars = 32 bytes).
 *
 * Ciphertext format: `<iv-hex>:<authTag-hex>:<ciphertext-hex>`
 * This is safe to store as a plain string column in Postgres.
 */
import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

const ALG = "aes-256-gcm";

function getEncKey(): Buffer {
  const raw = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!raw || raw.length !== 64) {
    throw new Error(
      "CREDENTIAL_ENCRYPTION_KEY must be set to a 64-char hex string (32 bytes). " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return Buffer.from(raw, "hex");
}

export function encryptSecret(plaintext: string): string {
  const key = getEncKey();
  const iv = randomBytes(12); // 96-bit IV is standard for GCM
  const cipher = createCipheriv(ALG, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptSecret(ciphertext: string): string {
  const key = getEncKey();
  const parts = ciphertext.split(":");
  if (parts.length !== 3) throw new Error("Invalid ciphertext format");
  const [ivHex, authTagHex, dataHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const data = Buffer.from(dataHex, "hex");
  const decipher = createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}

/**
 * Returns the real secret key from a repository record.
 * The stored value is either already encrypted (contains ":") or raw (legacy plain).
 */
export function resolveSecretKey(stored: string): string {
  if (stored.includes(":")) {
    return decryptSecret(stored);
  }
  // plain-text fallback for dev/seed data
  return stored;
}
