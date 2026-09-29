# ecdat-demo-ml-platform

> ⚠️ **SCANNER TEST FIXTURE — DO NOT USE.** This repository is a synthetic
> target for the ECDAT Atlas discovery engine. All keys, certificates and
> secrets in this repository are throwaway values generated for this fixture
> only. They are **not used anywhere else**, are **not sensitive**, and
> **must never be reused** in a real system. The code deliberately contains
> weak and deprecated cryptography — do not copy it into production.

## Scenario

An internal ML feature-serving platform (Python, FastAPI, Poetry) built by a
data-science team without a security review — broad, shallow cryptography
mistakes spread across caching, TLS client config and SSH tooling, the kind
that accumulates when crypto isn't anyone's explicit job. Expected ECDAT
Atlas profile: **High**, broad language/detector-family coverage.

Connect this repository through the ECDAT Atlas GitHub App to trigger a scan.
See `EXPECTED_FINDINGS.md` for the full list of planted artefacts and the
detector rule ID that should catch each one.
