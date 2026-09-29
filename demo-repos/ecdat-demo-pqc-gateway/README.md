# ecdat-demo-pqc-gateway

> ⚠️ **SCANNER TEST FIXTURE.** This repository is a synthetic target for the
> ECDAT Atlas discovery engine, provided as the contrast case in the demo
> set. Keys and certificates referenced here are throwaway placeholders and
> must never be reused in a real system.

## Scenario

An API gateway (Go 1.22, Cloudflare CIRCL) built after the 2024 FIPS 203/204
finalization — hybrid post-quantum key exchange (X25519MLKEM768, ML-KEM-768),
ML-DSA-65 for critical-path signing, TLS 1.3 floor, AES-256-GCM. This is the
**contrast case**: everything else in the demo set shows what "behind" looks
like; this repository shows what "done" looks like.

Expected ECDAT Atlas profile: **Compliant**, PQC safety score around **6/10**
— clearly the strongest of the six repositories (vs. 0/10 for
`ecdat-demo-banking-core`) but not a perfect 10. That's intentional: this
repository also keeps **Ed25519** signing alongside ML-DSA-65, for interop
with clients that haven't migrated yet — the hybrid-transition pattern FIPS
204 itself recommends. Ed25519 is classically strong but genuinely *not*
quantum-safe, so it correctly pulls the score down rather than being scored
as if it were PQC. The gap between 0/10 and 6/10 is the demo; a scanner that
scored this repository a dishonest 10/10 despite the retained classical
signature scheme would be lying to the evaluator.

Connect this repository through the ECDAT Atlas GitHub App to trigger a scan.
See `EXPECTED_FINDINGS.md` for the full list of planted artefacts and the
detector rule ID that should catch each one.
