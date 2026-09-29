<#
.SYNOPSIS
  Initialises, commits and pushes all six ECDAT Atlas demo repositories to
  GitHub, creating each remote via the `gh` CLI if it doesn't already exist.

.EXAMPLE
  $env:GITHUB_OWNER = "your-org"; ./push-all.ps1
  $env:GITHUB_OWNER = "your-org"; ./push-all.ps1 -Public

.NOTES
  Requires: git, gh (authenticated via `gh auth login`).
#>
param(
  [switch]$Public
)

$ErrorActionPreference = "Stop"
$Visibility = if ($Public) { "--public" } else { "--private" }

if (-not $env:GITHUB_OWNER) {
  Write-Error "Set `$env:GITHUB_OWNER to your GitHub username or organisation."
  exit 1
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Write-Error "GitHub CLI (gh) is required — https://cli.github.com/"
  exit 1
}

$Repos = @(
  "ecdat-demo-payments-api",
  "ecdat-demo-banking-core",
  "ecdat-demo-iot-firmware",
  "ecdat-demo-ml-platform",
  "ecdat-demo-pqc-gateway",
  "ecdat-demo-platform-infra"
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

foreach ($repo in $Repos) {
  $dir = Join-Path $ScriptDir $repo
  Write-Host "==> $repo"
  Push-Location $dir
  try {
    if (-not (Test-Path ".git")) {
      git init -q
      git checkout -q -b main
    }

    git add -A
    $staged = git diff --cached --quiet; if ($LASTEXITCODE -ne 0) {
      git commit -q -m "Initial commit — ECDAT Atlas demo fixture"
    }

    gh repo view "$env:GITHUB_OWNER/$repo" *>$null
    if ($LASTEXITCODE -ne 0) {
      gh repo create "$env:GITHUB_OWNER/$repo" $Visibility --source=. --remote=origin --push
    } else {
      git remote add origin "https://github.com/$env:GITHUB_OWNER/$repo.git" 2>$null
      git push -u origin main
    }

    Write-Host "    pushed to https://github.com/$env:GITHUB_OWNER/$repo"
  } finally {
    Pop-Location
  }
}

Write-Host ""
Write-Host "All six demo repositories pushed. Connect them through the ECDAT Atlas"
Write-Host "GitHub App (Scanning > Repositories > Connect GitHub) to trigger scans."
