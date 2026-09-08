# ecdat-demo-platform-infra

> ⚠️ **SCANNER TEST FIXTURE — DO NOT USE.** This repository is a synthetic
> target for the ECDAT Atlas discovery engine. All keys, certificates and
> secrets in this repository are throwaway values generated for this fixture
> only. They are **not used anywhere else**, are **not sensitive**, and
> **must never be reused** in a real system. The code deliberately contains
> weak and deprecated cryptography — do not copy it into production.

## Scenario

Infrastructure-as-code for a platform team's edge layer (Terraform, nginx,
Kubernetes, sshd) — no application source code at all. This is the
config-only demo repository: every planted weakness lives in a protocol or
certificate configuration file, not a call site. Expected ECDAT Atlas
profile: **Moderate**.

Connect this repository through the ECDAT Atlas GitHub App to trigger a scan.
See `EXPECTED_FINDINGS.md` for the full list of planted artefacts and the
detector rule ID that should catch each one.
