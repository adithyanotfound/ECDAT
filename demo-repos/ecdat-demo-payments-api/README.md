# ecdat-demo-payments-api

> ⚠️ **SCANNER TEST FIXTURE — DO NOT USE.** This repository is a synthetic
> target for the ECDAT Atlas discovery engine. All keys, certificates and
> secrets in this repository are throwaway values generated for this fixture
> only. They are **not used anywhere else**, are **not sensitive**, and
> **must never be reused** in a real system. The code deliberately contains
> weak and deprecated cryptography — do not copy it into production.

## Scenario

A mid-size payments API (Node.js / TypeScript / Express) with realistic,
mixed-strength cryptography: some good choices (RSA-2048 signing, bcrypt
password hashing), some bad ones (MD5 idempotency keys, low bcrypt cost) —
the kind of inventory a real, actively-developed service accumulates over a
few years. Expected ECDAT Atlas profile: **High** risk, broad detector
coverage across call-sites, manifests, certificates and keys.

Connect this repository through the ECDAT Atlas GitHub App to trigger a scan.
See `EXPECTED_FINDINGS.md` for the full list of planted artefacts and the
detector rule ID that should catch each one.
