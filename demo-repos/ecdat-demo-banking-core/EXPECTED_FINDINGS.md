# Expected findings — ecdat-demo-banking-core

Regression fixture for the ECDAT Atlas discovery engine. Each row is a
planted artefact and the detector rule that should catch it.

| Artefact | File | Rule ID | Expected severity |
|---|---|---|---|
| `Cipher.getInstance("DES/ECB/PKCS5Padding")` | `LegacyCardCipher.java` | `java.cipherGetInstance` | Critical |
| `MessageDigest.getInstance("MD5")` | `LegacyCardCipher.java` | `java.messageDigest` | Critical |
| `SecureRandom.getInstance("SHA1PRNG")` | `LegacyCardCipher.java` | `java.secureRandom` | High |
| Hardcoded 64-bit DES key constant | `LegacyCardCipher.java` | `key.hardcodedSymmetric` | Critical |
| `bcprov-jdk15on:1.46` (BouncyCastle, 2011) | `pom.xml` | `manifest.pomXml` | — (inventory only) |
| `bankcore.jks` keystore container | `src/main/resources/bankcore.jks` | `cert.jksP12` | — (inventory only, container flagged) |

## Known gaps (by design)

- The JKS keystore's actual certificate (self-signed, RSA-2048) is **not**
  extracted — ECDAT Atlas does not attempt to open password-protected
  keystores during a scan (see `certificates.ts`). Only its presence is
  recorded.
- `application.properties`' plaintext `server.ssl.key-store-password` is
  short enough (18 chars) to fall under the entropy-gate's 20-character
  minimum for the generic secrets detector — flagged here in
  `EXPECTED_FINDINGS.md` instead, as a reminder that short weak passwords
  need a dedicated low-entropy/dictionary rule the v1 rule packs don't have.
