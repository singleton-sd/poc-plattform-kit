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
BRANCH='production'
PLATFORM_DB='neondb'
OPENFGA_DB='openfga'

cd "$ROOT"

if [[ -z "${NEON_API_KEY:-}" ]] && ! npx neon profile list -o json 2>/dev/null | grep -q '"account": "[^"-]'; then
  echo "error: set NEON_API_KEY or run 'npx neon auth' first" >&2
  exit 1
fi

set_env_var() {
  local file="$1" key="$2" value="$3"
  touch "$file"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    python3 - "$file" "$key" "$value" <<'PY'
import pathlib, sys
path, key, value = sys.argv[1:4]
lines = pathlib.Path(path).read_text().splitlines()
out = []
replaced = False
prefix = key + "="
for line in lines:
    if line.startswith(prefix):
        out.append(prefix + value)
        replaced = True
    else:
        out.append(line)
if not replaced:
    out.append(prefix + value)
pathlib.Path(path).write_text("\n".join(out) + "\n")
PY
  else
    printf '%s=%s\n' "$key" "$value" >>"$file"
  fi
}

echo "==> Linking Neon project $PROJECT_ID"
npx neon link --org-id "$ORG_ID" --project-id "$PROJECT_ID" -y --no-env-pull

echo "==> Pulling platform env to $ROOT/.env"
(cd "$ROOT" && npx neon env pull --file .env)

echo "==> Fetching OpenFGA database connection strings ($OPENFGA_DB)"
OPENFGA_DATASTORE_URI="$(
  npx neon connection-string "$BRANCH" --database-name "$OPENFGA_DB" --pooled 2>/dev/null | tail -1
)"
OPENFGA_DATASTORE_URI_UNPOOLED="$(
  npx neon connection-string "$BRANCH" --database-name "$OPENFGA_DB" 2>/dev/null | tail -1
)"

set_env_var "$ROOT/.env" OPENFGA_DATASTORE_ENGINE postgres
set_env_var "$ROOT/.env" OPENFGA_DATASTORE_URI "$OPENFGA_DATASTORE_URI"
set_env_var "$ROOT/.env" OPENFGA_DATASTORE_URI_UNPOOLED "$OPENFGA_DATASTORE_URI_UNPOOLED"

echo "==> Syncing Prisma env to packages/db/.env"
cp "$ROOT/.env" "$ROOT/packages/db/.env"

echo "==> Neon context:"
cat "$ROOT/.neon" 2>/dev/null || true

echo "OK: DATABASE_URL, DATABASE_URL_UNPOOLED, and OpenFGA datastore URLs written (gitignored)."
