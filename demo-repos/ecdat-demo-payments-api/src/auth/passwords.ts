/**
 * Password hashing — bcrypt at cost factor 8.
 * ECDAT fixture note: bcrypt is the right primitive; cost 8 is the planted
 * weakness — below the 2024-era recommended floor of 10-12, so it shows up
 * as a moderate finding rather than a critical one.
 */
import bcrypt from "bcryptjs";

const BCRYPT_COST = 8;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
