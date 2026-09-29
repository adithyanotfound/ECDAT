# Expected findings — ecdat-demo-platform-infra

Regression fixture for the ECDAT Atlas discovery engine. Each row is a
planted artefact and the detector rule that should catch it. This is the
config-only demo repository — there is no application source code, so
every hit comes from the protocol-config and certificate detector families.

| Artefact | File | Rule ID | Expected severity |
|---|---|---|---|
| `ssl_protocols TLSv1 TLSv1.1 TLSv1.2` | `nginx/nginx.conf` | `protocol.nginxSslProtocols` | High |
| `ssl_ciphers` including 3DES/RC4 | `nginx/nginx.conf` | `protocol.nginxSslProtocols` (cipher branch) | High |
| Expiring, SHA-1-signed TLS cert (10-day validity) | `nginx/server.crt` | `cert.pem` | High |
| `KexAlgorithms diffie-hellman-group1-sha1` | `ssh/sshd_config` | `protocol.sshdConfig` | High |
| `Ciphers ...,3des-cbc` | `ssh/sshd_config` | `protocol.sshdConfig` | High |
| `MACs ...,hmac-md5` | `ssh/sshd_config` | `protocol.sshdConfig` | High |
| `kubernetes.io/tls` secret | `k8s/edge-tls-secret.yaml` | `protocol.k8sTlsSecret` | — (inventory only) |
| `ssl_policy = "ELBSecurityPolicy-TLS-1-0-2015-04"` | `terraform/main.tf` | `protocol.terraformTls` | High |
| `aws_kms_key.platform_signing_key` | `terraform/main.tf` | `protocol.terraformTls` (KMS branch) | — (inventory only) |

## Known gaps (by design)

- The GitHub Actions release workflow's `gpg --detach-sign` step
  (`.github/workflows/release.yml`) is included for scenario completeness
  (IMPLEMENTATION_PLAN.md §4 names "a workflow signing step" as a planted
  artefact) but is **not** matched by any current rule — CI/CD signing
  steps are a plausible future rule pack, not one of the six detector
  families implemented in this build.
