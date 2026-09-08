#!/usr/bin/env bash
# Initialises, commits and pushes all six ECDAT Atlas demo repositories to
# GitHub, creating each remote via the `gh` CLI if it doesn't already exist.
#
# Usage:
#   GITHUB_OWNER=your-org ./push-all.sh [--public]
#
# Requires: git, gh (authenticated via `gh auth login`).
set -euo pipefail

VISIBILITY="--private"
if [[ "${1:-}" == "--public" ]]; then
  VISIBILITY="--public"
fi

if [[ -z "${GITHUB_OWNER:-}" ]]; then
  echo "Set GITHUB_OWNER to your GitHub username or organisation." >&2
  exit 1
fi

if ! command -v gh &>/dev/null; then
  echo "GitHub CLI (gh) is required — https://cli.github.com/" >&2
  exit 1
fi

REPOS=(
  ecdat-demo-payments-api
  ecdat-demo-banking-core
  ecdat-demo-iot-firmware
  ecdat-demo-ml-platform
  ecdat-demo-pqc-gateway
  ecdat-demo-platform-infra
)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for repo in "${REPOS[@]}"; do
  dir="$SCRIPT_DIR/$repo"
  echo "==> $repo"
  cd "$dir"

  if [[ ! -d .git ]]; then
    git init -q
    git checkout -q -b main
  fi

  git add -A
  if ! git diff --cached --quiet; then
    git commit -q -m "Initial commit — ECDAT Atlas demo fixture"
  fi

  if ! gh repo view "$GITHUB_OWNER/$repo" &>/dev/null; then
    gh repo create "$GITHUB_OWNER/$repo" $VISIBILITY --source=. --remote=origin --push
  else
    git remote add origin "https://github.com/$GITHUB_OWNER/$repo.git" 2>/dev/null || true
    git push -u origin main
  fi

  echo "    pushed to https://github.com/$GITHUB_OWNER/$repo"
done

echo
echo "All six demo repositories pushed. Connect them through the ECDAT Atlas"
echo "GitHub App (Scanning > Repositories > Connect GitHub) to trigger scans."
