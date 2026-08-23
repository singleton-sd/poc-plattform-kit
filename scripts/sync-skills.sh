#!/usr/bin/env bash
# DEPRECATED — use `pnpm skills:install:pin`.
# Kept as a thin wrapper for older docs/muscle memory (WSL / macOS / Linux).

set -euo pipefail

echo "warning: scripts/sync-skills.sh is deprecated. Running pnpm skills:install:pin." >&2

if ! command -v pnpm >/dev/null 2>&1; then
  echo "error: pnpm is not available on PATH. Install pnpm, then re-run or use: pnpm skills:install:pin" >&2
  exit 1
fi

exec pnpm skills:install:pin
