/**
 * Session tokens — RS256-signed JWTs using the RSA-2048 keypair in ../../keys.
 * ECDAT fixture note: RS256 is not itself broken but is quantum-vulnerable
 * (RSA signing) — this is the "plan a PQC migration" case, not "fix now".
 */
import jwt from "jsonwebtoken";
import { readFileSync } from "fs";
import { join } from "path";

const PRIVATE_KEY = readFileSync(join(__dirname, "../../keys/rsa_private.pem"), "utf8");

export function issueSessionToken(userId: string): string {
  return jwt.sign({ sub: userId, scope: "payments:write" }, PRIVATE_KEY, {
    algorithm: "RS256",
    expiresIn: "1h",
  });
}
