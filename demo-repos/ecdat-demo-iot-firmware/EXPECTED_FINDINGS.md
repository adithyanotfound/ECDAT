# Expected findings — ecdat-demo-iot-firmware

Regression fixture for the ECDAT Atlas discovery engine. Each row is a
planted artefact and the detector rule that should catch it.

| Artefact | File | Rule ID | Expected severity |
|---|---|---|---|
| RSA-1024 device identity key | `include/device_identity.pem` | `key.pemBlock` | Critical (below NIST floor) |
| Hand-rolled `xor_obfuscate()` | `src/device_crypto.c` | `c.xorObfuscation` | Critical |
| Hardcoded AES-128 key constant | `src/device_crypto.c` | `key.hardcodedSymmetric` | Critical |
| `mbedtls_aes_setkey_enc` / `crypt_ecb` (ECB mode) | `src/device_crypto.c` | `c.mbedtlsCipher` | — (inventory; ECB usage compounds the hardcoded-key finding) |
| `mbedtls_sha1()` firmware manifest hash | `src/device_crypto.c` | `c.mbedtlsDigest` | High (derived from CRSF risk category) |
| `MBEDTLS_SSL_MINOR_VERSION_1` (TLS 1.0 floor) | `src/main.c` | `c.mbedtlsSslMinor` | Critical |
| mbedTLS dependency | `CMakeLists.txt` | `manifest.cmakeLists` | — (inventory only) |

## Why this repo matters for Mosca

`dataLifetimeYears` for this repository should be set high (15-20) in its
repository settings — industrial sensor firmware in the field for two
decades. With that setting, every quantum-vulnerable artefact here (the
RSA-1024 key) should compute `moscaVerdict = ACT_NOW`, since `X + Y > Z`
comfortably holds even under a conservative CRQC estimate. This is the demo
repository that makes Mosca's inequality concrete rather than abstract.
