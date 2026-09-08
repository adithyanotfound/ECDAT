# Expected findings — ecdat-demo-pqc-gateway

Regression fixture for the ECDAT Atlas discovery engine. Each row is a
planted artefact and the detector rule that should catch it. Unlike the
other five demo repositories, **nothing here should be Critical or High** —
this is the repository that proves the scanner doesn't cry wolf.

| Artefact | File | Rule ID | Expected severity |
|---|---|---|---|
| `X25519MLKEM768` hybrid KEX | `internal/tlsconfig/tlsconfig.go` | `go.x25519mlkem768` | — (inventory, quantum-safe) |
| `MinVersion: tls.VersionTLS13` | `internal/tlsconfig/tlsconfig.go` | `go.tlsMinVersion` | — (inventory, no weak-version flag) |
| `circl/kem/mlkem768` (ML-KEM-768) | `internal/tlsconfig/kem.go` | `go.circlMlkem` | — (inventory, quantum-safe) |
| `circl/sign/ed25519` | `internal/tlsconfig/sign.go` | `go.circlSign` | — (inventory, quantum-vulnerable — see README) |
| `circl/sign/dilithium` (ML-DSA-65) | `internal/tlsconfig/sign_pqc.go` | `go.circlSign` | — (inventory, quantum-safe) |
| `crypto/aes` (AES-256-GCM data plane) | `cmd/gateway/main.go` | `go.cryptoImport` | — (inventory, quantum-safe — key size inferred from the `[32]byte` parameter) |
| `cloudflare/circl` dependency | `go.mod` | `manifest.goMod` | — (inventory only) |

## Why the PQC score isn't a perfect 10

`circl/sign/ed25519` is real, planted, and intentionally *not* excluded —
see the README for why a repository that keeps a classical signature scheme
for interop shouldn't be scored as if it were fully migrated.
