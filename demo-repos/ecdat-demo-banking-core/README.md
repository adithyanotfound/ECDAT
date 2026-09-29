# ecdat-demo-banking-core

> ⚠️ **SCANNER TEST FIXTURE — DO NOT USE.** This repository is a synthetic
> target for the ECDAT Atlas discovery engine. All keys, certificates and
> secrets in this repository are throwaway values generated for this fixture
> only. They are **not used anywhere else**, are **not sensitive**, and
> **must never be reused** in a real system. The code deliberately contains
> weak and deprecated cryptography — do not copy it into production.

## Scenario

A legacy Java 8 / Spring Boot core-banking service (Maven), unmaintained
since the mid-2010s, running BouncyCastle 1.46 (2011) alongside JDK defaults
that have since been deprecated. This is the **worst-case repository** in
the demo set — every planted artefact is broken or below the NIST floor.
Expected ECDAT Atlas profile: **Critical**, PQC safety score ≤3/10.

Connect this repository through the ECDAT Atlas GitHub App to trigger a scan.
See `EXPECTED_FINDINGS.md` for the full list of planted artefacts and the
detector rule ID that should catch each one.
