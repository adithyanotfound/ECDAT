# ecdat-demo-iot-firmware

> ⚠️ **SCANNER TEST FIXTURE — DO NOT USE.** This repository is a synthetic
> target for the ECDAT Atlas discovery engine. All keys, certificates and
> secrets in this repository are throwaway values generated for this fixture
> only. They are **not used anywhere else**, are **not sensitive**, and
> **must never be reused** in a real system. The code deliberately contains
> weak and deprecated cryptography — do not copy it into production.

## Scenario

Firmware for a long-lifetime industrial IoT sensor (C, mbedTLS, CMake).
Devices in this class ship for 15-20 years — the Mosca-inequality
calculation (data lifetime + migration time > time to CRQC) fails hard here
even though nothing looks urgent today. Expected ECDAT Atlas profile:
**Critical**, `moscaVerdict = ACT_NOW` on every quantum-vulnerable asset
given the device's long `dataLifetimeYears`.

Connect this repository through the ECDAT Atlas GitHub App to trigger a scan.
See `EXPECTED_FINDINGS.md` for the full list of planted artefacts and the
detector rule ID that should catch each one.
