#!/usr/bin/env bash
# Stage the App Service API zip the same way deploy-api.yml does.
# Run from repo root (Git Bash / WSL / Ubuntu CI). Not PowerShell.
#
# Usage:
#   bash ./scripts/stage-api-deploy.sh           # package + require smoke
#   bash ./scripts/stage-api-deploy.sh --kudu    # also simulate Kudu node_modules.tar.gz extract
#   bash ./scripts/stage-api-deploy.sh --kudu --serve  # + start node and curl /health
set -euo pipefail

DO_KUDU=false
DO_SERVE=false
for arg in "$@"; do
  case "$arg" in
    --kudu) DO_KUDU=true ;;
    --serve) DO_SERVE=true ;;
    -h|--help)
      sed -n '2,10p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 2
      ;;
  esac
done

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DEPLOY_DIR="${GITHUB_WORKSPACE:-$ROOT}/.deploy/api"
ZIP_PATH="${GITHUB_WORKSPACE:-$ROOT}/api-deploy.zip"
NPMRC="$ROOT/.npmrc"
NPMRC_BACKUP=""
NPMRC_EXISTED=false
MAX_ZIP_BYTES=314572800

cleanup_npmrc() {
  if [[ -n "$NPMRC_BACKUP" && -f "$NPMRC_BACKUP" ]]; then
    if [[ "$NPMRC_EXISTED" == true ]]; then
      mv -f "$NPMRC_BACKUP" "$NPMRC"
    else
      rm -f "$NPMRC" "$NPMRC_BACKUP"
    fi
  fi
}
trap cleanup_npmrc EXIT

echo "==> Staging API deploy under $DEPLOY_DIR"

rm -rf "${GITHUB_WORKSPACE:-$ROOT}/.deploy" "${ROOT}/apps/api/.deploy" "$ZIP_PATH"
mkdir -p "$(dirname "$DEPLOY_DIR")"

# Deploy-only hoisted layout (restore .npmrc on exit so local monorepo stays isolated).
# App Service OneDeploy re-tars node_modules → /node_modules; isolated pnpm siblings
# (e.g. tslib under @nestjs/common) break. Do not use rsync -aL.
NPMRC_BACKUP="$(mktemp)"
if [[ -f "$NPMRC" ]]; then
  NPMRC_EXISTED=true
  cp "$NPMRC" "$NPMRC_BACKUP"
else
  NPMRC_EXISTED=false
fi
# Replace with a clean UTF-8 deploy config (avoid appending to a UTF-16/.NET-mangled file).
printf '%s\n' \
  'inject-workspace-packages=true' \
  'node-linker=hoisted' \
  'shamefully-hoist=true' \
  >"$NPMRC"

pnpm --filter @poc-plattform-kit/api deploy --prod "$DEPLOY_DIR"

# dist/ is gitignored; pnpm deploy may omit it — copy explicitly.
rm -rf "$DEPLOY_DIR/dist"
cp -r "$ROOT/apps/api/dist" "$DEPLOY_DIR/dist"

# Drop non-runtime paths copied from the package.
rm -rf "$DEPLOY_DIR/src" "$DEPLOY_DIR/Dockerfile" \
  "$DEPLOY_DIR/tsconfig.json" "$DEPLOY_DIR/tsconfig.build.json" \
  "$DEPLOY_DIR/nest-cli.json" "$DEPLOY_DIR"/jest.config.* \
  "$DEPLOY_DIR/test" "$DEPLOY_DIR/coverage"

# pnpm deploy --prod installs @prisma/client but does not run `prisma generate`
# (prisma CLI is a packages/db devDependency). App Service then crashes:
#   @prisma/client did not initialize yet. Please run "prisma generate"...
# Generate MUST use a schema inside DEPLOY_DIR — otherwise Prisma writes into the
# monorepo .pnpm store (path relative to packages/db) and the zip keeps the stub.
SCHEMA_SRC="$ROOT/packages/db/prisma/schema.prisma"
test -f "$SCHEMA_SRC"
mkdir -p "$DEPLOY_DIR/prisma"
cp "$SCHEMA_SRC" "$DEPLOY_DIR/prisma/schema.prisma"
PRISMA_CLI=""
for candidate in \
  "$ROOT/node_modules/.bin/prisma" \
  "$ROOT/packages/db/node_modules/.bin/prisma"
do
  if [[ -e "$candidate" ]]; then
    PRISMA_CLI="$candidate"
    break
  fi
done
if [[ -z "$PRISMA_CLI" ]]; then
  echo "::error::prisma CLI not found under repo node_modules; run pnpm install first" >&2
  exit 1
fi
echo "==> prisma generate into $DEPLOY_DIR (schema=$DEPLOY_DIR/prisma/schema.prisma)"
(
  cd "$DEPLOY_DIR"
  export DATABASE_URL="${DATABASE_URL:-sqlserver://localhost:1433;database=ci;user=ci;password=ci;encrypt=true;trustServerCertificate=true}"
  "$PRISMA_CLI" generate --schema "$DEPLOY_DIR/prisma/schema.prisma"
)
# Stub default.js exists before generate; real client ships index.js + engines.
test -f "$DEPLOY_DIR/node_modules/.prisma/client/index.js"
test -f "$DEPLOY_DIR/node_modules/.prisma/client/default.js"

# Shrink: drop non-Linux Prisma engines + source maps (App Service is Linux).
# Run AFTER generate so the Linux query engine is present first.
find "$DEPLOY_DIR/node_modules" -type f \( \
  -name '*darwin*' -o -name '*windows*' -o -name '*.exe' -o \
  -name '*debian-openssl-1.1*' -o -name '*.map' \
\) -delete
find "$DEPLOY_DIR/node_modules" -type f -name '*.md' -delete

DEPLOY_DIR="$DEPLOY_DIR" node <<'EOF'
const fs = require('fs');
const dir = process.env.DEPLOY_DIR;
const pkg = JSON.parse(fs.readFileSync(`${dir}/package.json`, 'utf8'));
pkg.scripts = { start: 'node dist/main.js' };
delete pkg.devDependencies;
delete pkg.jest;
fs.writeFileSync(`${dir}/package.json`, JSON.stringify(pkg, null, 2) + '\n');
EOF

printf '%s\n' \
  '[config]' \
  'SCM_DO_BUILD_DURING_DEPLOYMENT=false' \
  >"$DEPLOY_DIR/.deployment"

test -f "$DEPLOY_DIR/dist/main.js"
test -d "$DEPLOY_DIR/node_modules/@nestjs/common"
test -d "$DEPLOY_DIR/node_modules/tslib"
test -d "$DEPLOY_DIR/node_modules/@poc-plattform-kit/db"
test -d "$DEPLOY_DIR/node_modules/@poc-plattform-kit/pillar-tenant"

(cd "$DEPLOY_DIR" && node -e "require('@nestjs/common'); require('tslib'); const {PrismaClient}=require('@prisma/client'); new PrismaClient(); console.log('hypothesisId=G message=hoisted module + prisma generate ok')")

(cd "$DEPLOY_DIR" && zip -r -q -9 "$ZIP_PATH" .)
ls -lh "$ZIP_PATH"
size_bytes="$(stat -c%s "$ZIP_PATH" 2>/dev/null || stat -f%z "$ZIP_PATH")"
echo "hypothesisId=H3 zipBytes=$size_bytes"
echo "hypothesisId=G deployDir=$DEPLOY_DIR"

if [[ "$size_bytes" -gt "$MAX_ZIP_BYTES" ]]; then
  echo "::error::Deploy zip is ${size_bytes} bytes (>300MB). Refusing upload — likely to 504 on B1." >&2
  exit 1
fi
echo "hypothesisId=H3 message=staged hoisted pnpm deploy zip"

if [[ "$DO_KUDU" == true ]]; then
  echo "==> Kudu simulation: tar node_modules and extract elsewhere"
  KUDU_TMP="$(mktemp -d)"
  WWWROOT="$KUDU_TMP/wwwroot"
  EXTRACTED_NM="$KUDU_TMP/node_modules"
  mkdir -p "$WWWROOT" "$EXTRACTED_NM"
  # Mimic OneDeploy: package node_modules as tar.gz, sync the rest without node_modules.
  tar -czf "$WWWROOT/node_modules.tar.gz" -C "$DEPLOY_DIR/node_modules" .
  cp -a "$DEPLOY_DIR/dist" "$WWWROOT/dist"
  cp -a "$DEPLOY_DIR/package.json" "$WWWROOT/package.json"
  cp -a "$DEPLOY_DIR/.deployment" "$WWWROOT/.deployment"
  tar -xzf "$WWWROOT/node_modules.tar.gz" -C "$EXTRACTED_NM"
  # App Service startup links /node_modules → wwwroot/node_modules
  ln -sfn "$EXTRACTED_NM" "$WWWROOT/node_modules"
  (cd "$WWWROOT" && node -e "require('@nestjs/common'); require('tslib'); const {PrismaClient}=require('@prisma/client'); new PrismaClient(); console.log('hypothesisId=G message=kudu extract module + prisma ok')")
  rm -rf "$KUDU_TMP"
fi

if [[ "$DO_SERVE" == true ]]; then
  echo "==> Serve smoke: node dist/main.js + curl /health"
  (
    cd "$DEPLOY_DIR"
    PORT=8080 NODE_ENV=production node dist/main.js
  ) &
  serve_pid=$!
  cleanup_serve() {
    kill "$serve_pid" 2>/dev/null || true
    wait "$serve_pid" 2>/dev/null || true
  }
  trap 'cleanup_serve; cleanup_npmrc' EXIT
  ok=false
  for _ in $(seq 1 30); do
    code="$(curl -sS -o /tmp/api-health.json -w '%{http_code}' http://127.0.0.1:8080/health || true)"
    if [[ "$code" == "200" ]]; then
      echo "hypothesisId=A message=local health ok"
      cat /tmp/api-health.json || true
      echo
      ok=true
      break
    fi
    sleep 1
  done
  cleanup_serve
  trap cleanup_npmrc EXIT
  if [[ "$ok" != true ]]; then
    echo "::error::Local /health did not return 200" >&2
    exit 1
  fi
fi
