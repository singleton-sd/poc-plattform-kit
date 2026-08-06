#!/usr/bin/env bash
# Run stage-api-deploy.sh inside Linux (Docker) with a copy of the repo.
# Use this on Windows — Docker Desktop bind mounts break pnpm rename (EACCES).
#
# Usage (from repo root, PowerShell or bash):
#   bash ./scripts/stage-api-deploy-docker.sh
#   bash ./scripts/stage-api-deploy-docker.sh --kudu
#   bash ./scripts/stage-api-deploy-docker.sh --kudu --serve
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# Docker Desktop on Windows needs a Windows path (C:\...), not Git Bash /c/...
if ROOT_WIN="$(cd "$(dirname "$0")/.." && pwd -W 2>/dev/null)"; then
  ROOT="$ROOT_WIN"
elif command -v cygpath >/dev/null 2>&1; then
  ROOT="$(cygpath -w "$ROOT")"
fi
IMAGE="${STAGE_API_DOCKER_IMAGE:-node:20-bookworm}"

# Prefer docker.exe on Windows/WSL — the `docker` shim often prints
# "WSL integration" errors when Desktop integration is off.
DOCKER_BIN=""
if command -v docker.exe >/dev/null 2>&1; then
  DOCKER_BIN=docker.exe
elif command -v docker >/dev/null 2>&1; then
  DOCKER_BIN=docker
else
  echo "docker not found (install Docker Desktop; enable WSL integration or put docker.exe on PATH)" >&2
  exit 127
fi

"$DOCKER_BIN" run --rm \
  -v "${ROOT}:/src:ro" \
  -e DATABASE_URL="${DATABASE_URL:-sqlserver://localhost:1433;database=dummy;user=sa;password=dummy;encrypt=true;trustServerCertificate=true}" \
  -e "STAGE_ARGS=$*" \
  "$IMAGE" \
  bash -lc '
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq && apt-get install -y -qq zip >/dev/null
mkdir -p /work
# Copy sources onto Linux FS (exclude host node_modules / deploy artifacts).
tar -C /src \
  --exclude=node_modules \
  --exclude=.deploy \
  --exclude=api-deploy.zip \
  --exclude=api-deploy.tar \
  --exclude=.git \
  --exclude=dist \
  -cf - . | tar -C /work -xf -
cd /work
sed -i "s/\r$//" scripts/stage-api-deploy.sh scripts/stage-api-deploy-docker.sh
printf "%s\n" "inject-workspace-packages=true" > .npmrc
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm install --frozen-lockfile
# Prefer the API package build (prebuild pulls db + tenant); avoid fragile events tsc PATH issues.
pnpm --filter @poc-plattform-kit/api run build
# shellcheck disable=SC2086
bash ./scripts/stage-api-deploy.sh ${STAGE_ARGS:-}
'
