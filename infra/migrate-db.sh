#!/usr/bin/env bash
# Apply forward-only Prisma migrations to Neon PostgreSQL using Key Vault URLs.
#
# Pulls `database-url` (pooled) and `database-url-unpooled` (direct / Prisma
# `directUrl`) from Key Vault into a gitignored `packages/db/.env`, then runs
# `prisma migrate deploy` (never `migrate dev` against shared Neon).
#
# Never prints secret values. Never put DATABASE_URL in GitHub Secrets — use
# OIDC → Key Vault locally or in a future CI job.
#
# Usage:
#   ./infra/migrate-db.sh
#   ./infra/migrate-db.sh --what-if
#   ./infra/migrate-db.sh --status-only
#   ./infra/migrate-db.sh --help

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DB_DIR="$REPO_ROOT/packages/db"
ENV_FILE="$DB_DIR/.env"

SUBSCRIPTION_ID="${SUBSCRIPTION_ID:-7b8343d7-969f-4b71-8864-b7925e7fae30}"
KEY_VAULT_NAME="${KEY_VAULT_NAME:-ssd-pocpk-kv-dev-ae}"
SECRET_NAME="${SECRET_NAME:-database-url}"
UNPOOLED_SECRET_NAME="${UNPOOLED_SECRET_NAME:-database-url-unpooled}"

WHAT_IF=0
STATUS_ONLY=0

die() { echo "error: $*" >&2; exit 1; }
step() { printf '\n==> %s\n' "$1"; }

usage() {
  cat <<'EOF'
Usage: ./infra/migrate-db.sh [options]

Options:
  --what-if              Show intended actions without writing secrets or migrating
  --status-only          Write .env from KV then run `prisma migrate status` only
  --subscription-id ID   Azure subscription (default: PoC subscription)
  --key-vault-name NAME  Key Vault name (default: ssd-pocpk-kv-dev-ae)
  --secret-name NAME     Pooled URL secret (default: database-url)
  --unpooled-secret NAME Direct URL secret (default: database-url-unpooled)
  -h, --help             Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --what-if) WHAT_IF=1; shift ;;
    --status-only) STATUS_ONLY=1; shift ;;
    --subscription-id) SUBSCRIPTION_ID="${2:?}"; shift 2 ;;
    --key-vault-name) KEY_VAULT_NAME="${2:?}"; shift 2 ;;
    --secret-name) SECRET_NAME="${2:?}"; shift 2 ;;
    --unpooled-secret) UNPOOLED_SECRET_NAME="${2:?}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown argument: $1 (try --help)" ;;
  esac
done

[[ -d "$DB_DIR" ]] || die "packages/db not found at $DB_DIR"

step "Setting subscription $SUBSCRIPTION_ID"
az account set --subscription "$SUBSCRIPTION_ID"
[[ $? -eq 0 ]] || die "az account set failed"

step "Reading Key Vault secret $SECRET_NAME from $KEY_VAULT_NAME (value not logged)"
database_url="$(az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name "$SECRET_NAME" --query value -o tsv)"
[[ -n "${database_url:-}" ]] || die "Failed to read $SECRET_NAME from Key Vault"

step "Reading Key Vault secret $UNPOOLED_SECRET_NAME (Prisma directUrl; value not logged)"
database_url_unpooled="$(az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name "$UNPOOLED_SECRET_NAME" --query value -o tsv 2>/dev/null || true)"
if [[ -z "${database_url_unpooled:-}" ]]; then
  die "Failed to read $UNPOOLED_SECRET_NAME from Key Vault (required for Prisma directUrl / migrate; do not use the pooled URL)"
fi

if [[ "$WHAT_IF" -eq 1 ]]; then
  echo "WhatIf: would write gitignored packages/db/.env (DATABASE_URL length=${#database_url}; UNPOOLED length=${#database_url_unpooled})"
  echo 'WhatIf: would run: pnpm exec prisma migrate deploy (cwd packages/db)'
  unset database_url database_url_unpooled
  exit 0
fi

step 'Writing gitignored packages/db/.env (values not logged)'
umask 077
tmp_env="$(mktemp)"
trap 'rm -f "$tmp_env"' EXIT
printf 'DATABASE_URL=%s\nDATABASE_URL_UNPOOLED=%s\n' "$database_url" "$database_url_unpooled" >"$tmp_env"
chmod 600 "$tmp_env"
mv "$tmp_env" "$ENV_FILE"
chmod 600 "$ENV_FILE"
trap - EXIT
unset database_url database_url_unpooled
unset DATABASE_URL DATABASE_URL_UNPOOLED || true

cd "$DB_DIR"
if [[ "$STATUS_ONLY" -eq 1 ]]; then
  step 'prisma migrate status'
  pnpm exec prisma migrate status
else
  step 'prisma migrate deploy (forward-only, Neon PostgreSQL)'
  pnpm exec prisma migrate deploy
  step 'prisma migrate status'
  pnpm exec prisma migrate status
fi

step 'Done'
echo 'Verify: POST https://api.plattform-kit.poc.singletonsd.com/tenants (or App Service host).'
