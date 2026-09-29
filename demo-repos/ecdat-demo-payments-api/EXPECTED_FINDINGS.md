# Expected findings — ecdat-demo-payments-api

Regression fixture for the ECDAT Atlas discovery engine. Each row is a
planted artefact and the detector rule that should catch it.

| Artefact | File | Rule ID | Expected severity |
|---|---|---|---|
| `aes-256-cbc` card tokenization cipher | `src/crypto/cardTokenizer.ts` | `js.createCipheriv` | Low (quantum-vulnerable-safe, no MAC) |
| `MD5` idempotency key | `src/crypto/idempotency.ts` | `js.createHash` | High |
| `RS256` JWT signing | `src/auth/tokens.ts` | `js.jwtAlg` | Moderate (quantum-vulnerable) |
| RSA-2048 private key committed to repo | `keys/rsa_private.pem` | `key.pemBlock` | Critical |
| Self-signed TLS server certificate | `certs/server.crt` | `cert.pem` | — (inventory only, valid cert) |
| `jsonwebtoken` dependency | `package.json` | `manifest.packageJson` | — (inventory only) |
| `node-forge` dependency | `package.json` | `manifest.packageJson` | — (inventory only) |
| `bcryptjs` dependency | `package.json` | `manifest.packageJson` | — (inventory only) |

## Known gaps (by design)

- **bcrypt cost factor 8** (`src/auth/passwords.ts`) is *not* detected — the
  call-site detector family matches algorithm identifiers, not numeric
  arguments. Flagging weak KDF cost factors would need a dedicated
  AST-level rule; out of scope for the regex-based v1 rule packs. Left in
  as an honest limitation, not a bug.
