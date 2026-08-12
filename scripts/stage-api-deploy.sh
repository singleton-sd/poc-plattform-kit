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
if [[ ! -d "$ROOT/apps/api/dist" ]]; then
  echo "::error::apps/api/dist missing before stage copy (build first)" >&2
  ls -la "$ROOT/apps/api" >&2 || true
  exit 1
fi
cp -r "$ROOT/apps/api/dist" "$DEPLOY_DIR/dist"
if [[ ! -f "$DEPLOY_DIR/dist/main.js" ]]; then
  echo "::error::dist/main.js missing after copy from apps/api/dist (nest emit failed or stale tsbuildinfo?)" >&2
  ls -la "$ROOT/apps/api/dist" >&2 || true
  ls -la "$DEPLOY_DIR/dist" >&2 || true
  exit 1
fi
echo "hypothesisId=G message=copied apps/api/dist/main.js"

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
#
# Also pin generator output. On Linux, Prisma follows @prisma/client's realpath
# into node_modules/.pnpm/... and never creates top-level .prisma/client/index.js.
# That made `test -f .../.prisma/client/index.js` exit 1 right after a "successful"
# generate (Deploy API run 31101080694). Explicit output keeps the client where
# App Service / hoisted require('@prisma/client') resolve it.
SCHEMA_SRC="$ROOT/packages/db/prisma/schema.prisma"
test -f "$SCHEMA_SRC"
mkdir -p "$DEPLOY_DIR/prisma"
cp "$SCHEMA_SRC" "$DEPLOY_DIR/prisma/schema.prisma"
DEPLOY_SCHEMA="$DEPLOY_DIR/prisma/schema.prisma" node <<'EOF'
const fs = require('fs');
const schemaPath = process.env.DEPLOY_SCHEMA;
let schema = fs.readFileSync(schemaPath, 'utf8');
if (!/output\s*=/.test(schema)) {
  schema = schema.replace(
    /generator\s+client\s*\{[^}]*provider\s*=\s*"prisma-client-js"/,
    (block) => `${block}\n  output   = "../node_modules/.prisma/client"`,
  );
  if (!/output\s*=/.test(schema)) {
    console.error('::error::Failed to pin prisma generator output in deploy schema');
    process.exit(1);
  }
  fs.writeFileSync(schemaPath, schema);
  console.log('hypothesisId=G message=pinned prisma generator output for deploy schema');
}
EOF
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
# Real client ships index.js + engines at the pinned top-level path.
# If generate still lands beside a pnpm virtual-store realpath, promote it.
assert_prisma_client() {
  local index_js="$DEPLOY_DIR/node_modules/.prisma/client/index.js"
  local default_js="$DEPLOY_DIR/node_modules/.prisma/client/default.js"
  if [[ -f "$index_js" && -f "$default_js" ]]; then
    echo "hypothesisId=G message=prisma client at top-level .prisma/client"
    return 0
  fi

  local found=""
  found="$(find "$DEPLOY_DIR/node_modules" -path '*/.prisma/client/index.js' -type f 2>/dev/null | head -n 1 || true)"
  if [[ -n "$found" ]]; then
    echo "hypothesisId=G message=promoting prisma client from $found"
    mkdir -p "$DEPLOY_DIR/node_modules/.prisma"
    rm -rf "$DEPLOY_DIR/node_modules/.prisma/client"
    cp -a "$(dirname "$found")" "$DEPLOY_DIR/node_modules/.prisma/client"
  fi

  if [[ -f "$index_js" && -f "$default_js" ]]; then
    echo "hypothesisId=G message=prisma client promoted to top-level .prisma/client"
    return 0
  fi

  echo "::error::prisma generate did not produce top-level .prisma/client (index.js/default.js)" >&2
  echo "Expected: $index_js" >&2
  ls -la "$DEPLOY_DIR/node_modules/.prisma/client" >&2 || true
  ls -la "$DEPLOY_DIR/node_modules/@prisma/client" >&2 || true
  find "$DEPLOY_DIR/node_modules" -path '*/.prisma/client/*' 2>/dev/null | head -n 40 >&2 || true
  return 1
}
assert_prisma_client

# Shrink: drop non-Linux Prisma engines + source maps (App Service is Linux).
# Run AFTER generate so the Linux query engine is present first.
# pnpm may hardlink store files read-only; chmod so unlink works. Still ignore
# find -delete non-zero so a single stubborn file cannot abort packaging
# (Deploy API run 31129411239 died here with set -e and no error text).
chmod -R u+w "$DEPLOY_DIR/node_modules" 2>/dev/null || true
find "$DEPLOY_DIR/node_modules" -type f \( \
  -name '*darwin*' -o -name '*windows*' -o -name '*.exe' -o \
  -name '*debian-openssl-1.1*' -o -name '*.map' \
\) -delete || true
find "$DEPLOY_DIR/node_modules" -type f -name '*.md' -delete || true

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

test -f "$DEPLOY_DIR/dist/main.js" || { echo "::error::missing dist/main.js" >&2; exit 1; }
test -d "$DEPLOY_DIR/node_modules/@nestjs/common" || { echo "::error::missing @nestjs/common" >&2; exit 1; }
test -d "$DEPLOY_DIR/node_modules/tslib" || { echo "::error::missing tslib (hoist failed)" >&2; exit 1; }
test -d "$DEPLOY_DIR/node_modules/@poc-plattform-kit/db" || { echo "::error::missing @poc-plattform-kit/db" >&2; exit 1; }
test -d "$DEPLOY_DIR/node_modules/@poc-plattform-kit/pillar-tenant" || { echo "::error::missing pillar-tenant" >&2; exit 1; }

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
