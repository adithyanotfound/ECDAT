# ECDAT Atlas demo repositories

> ⚠️ **Every repository below is a scanner test fixture.** Keys,
> certificates and secrets are throwaway values generated for these
> fixtures only, are not used anywhere else, and must never be reused in a
> real system. Each planted weakness is documented in that repository's own
> `EXPECTED_FINDINGS.md`, alongside the detector rule ID that should catch
> it — that file doubles as the discovery engine's precision regression
> suite (IMPLEMENTATION_PLAN.md §4).

| Repository | Stack | Expected profile |
|---|---|---|
| [`ecdat-demo-payments-api`](./ecdat-demo-payments-api) | Node · TypeScript · Express | High |
| [`ecdat-demo-banking-core`](./ecdat-demo-banking-core) | Java 8 · Spring Boot · Maven | Critical |
| [`ecdat-demo-iot-firmware`](./ecdat-demo-iot-firmware) | C · mbedTLS · CMake | Critical |
| [`ecdat-demo-ml-platform`](./ecdat-demo-ml-platform) | Python · FastAPI · Poetry | High |
| [`ecdat-demo-pqc-gateway`](./ecdat-demo-pqc-gateway) | Go 1.22 · CIRCL | Compliant |
| [`ecdat-demo-platform-infra`](./ecdat-demo-platform-infra) | Terraform · nginx · k8s | Moderate |

## Pushing all six to GitHub

Each repository here is a self-contained project tree, not yet an
initialised git repo. `push-all.sh` / `push-all.ps1` walk the six
directories, `git init` each one if needed, commit its contents, create a
matching repository under your GitHub account or org (via the `gh` CLI),
and push. You then connect each one through the ECDAT Atlas GitHub App to
trigger the initial scan.

```bash
# bash / macOS / Linux
GITHUB_OWNER=your-org ./push-all.sh

# PowerShell / Windows
$env:GITHUB_OWNER = "your-org"; ./push-all.ps1
```

Requires the [GitHub CLI](https://cli.github.com/) (`gh`), authenticated
(`gh auth login`), and `git`. Set `GITHUB_OWNER` to your GitHub username or
organisation — repositories are created as **private** by default; pass
`--public` to either script to override (only do this if you are
comfortable with the "scanner test fixture, weak crypto inside" label being
publicly visible).
