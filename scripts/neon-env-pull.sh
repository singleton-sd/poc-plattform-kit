#!/usr/bin/env bash
# Link Platform Kit to Neon and pull branch env into local .env files.
# Requires NEON_API_KEY or a completed `npx neon auth` session.
#
# Usage:
#   export NEON_API_KEY='napi_...'   # or: npx neon auth
#   ./scripts/neon-env-pull.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_ID='round-union-05852948'
ORG_ID='org-wild-forest-99153696'

cd "$ROOT"

if [[ -z "${NEON_API_KEY:-}" ]] && ! npx neon profile list -o json 2>/dev/null | grep -q '"account": "[^"-]'; then
  echo "error: set NEON_API_KEY or run 'npx neon auth' first" >&2
  exit 1
fi

echo "==> Linking Neon project $PROJECT_ID"
npx neon link --org-id "$ORG_ID" --project-id "$PROJECT_ID" -y --no-env-pull

echo "==> Pulling env to $ROOT/.env"
npx neon env pull --file "$ROOT/.env"

echo "==> Syncing Prisma env to packages/db/.env"
cp "$ROOT/.env" "$ROOT/packages/db/.env"

echo "==> Neon context:"
cat "$ROOT/.neon" 2>/dev/null || true

echo "OK: DATABASE_URL and DATABASE_URL_UNPOOLED written (gitignored)."
