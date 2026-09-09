#!/usr/bin/env bash
# After Container Apps production deploy: poll /health and /health/db until 200.
# Accounts for Consumption scale-from-zero + image pull cold start.
#
# Requires: curl, optional az CLI for log dump on failure.
# Env:
#   API_BASE_URL              (required) e.g. https://ssd-pocpk-aca-api-dev-ae....azurecontainerapps.io
#   AZURE_RESOURCE_GROUP      (optional) for log dump
#   AZURE_CONTAINER_APP_NAME  (optional) for log dump
#   VERIFY_TIMEOUT_SEC        (default 360)
#   VERIFY_POLL_SEC           (default 10)
#   VERIFY_CURL_MAX_TIME      (default 30)
set -euo pipefail

BASE="${API_BASE_URL:?API_BASE_URL required}"
BASE="${BASE%/}"
TIMEOUT_SEC="${VERIFY_TIMEOUT_SEC:-360}"
POLL_SEC="${VERIFY_POLL_SEC:-10}"
CURL_MAX_TIME="${VERIFY_CURL_MAX_TIME:-30}"
RG="${AZURE_RESOURCE_GROUP:-}"
APP="${AZURE_CONTAINER_APP_NAME:-}"

echo "==> Verify Container App API: $BASE (timeout ${TIMEOUT_SEC}s)"

http_code() {
  local url="$1"
  local out="$2"
  local code
  if code="$(curl -sS -o "$out" -w '%{http_code}' --max-time "$CURL_MAX_TIME" "$url")"; then
    printf '%s' "$code"
  else
    printf '000'
  fi
}

deadline=$(( $(date +%s) + TIMEOUT_SEC ))
attempt=0

while [[ "$(date +%s)" -lt "$deadline" ]]; do
  attempt=$((attempt + 1))
  code_health="$(http_code "$BASE/health" /tmp/aca-api-health.json)"
  code_db="$(http_code "$BASE/health/db" /tmp/aca-api-health-db.json)"
  echo "attempt $attempt: /health=$code_health /health/db=$code_db"
  # Both endpoints must be 200 in the same poll — no sticky cross-attempt OK.
  if [[ "$code_health" == "200" && "$code_db" == "200" ]]; then
    echo "OK — /health and /health/db returned 200"
    cat /tmp/aca-api-health.json 2>/dev/null || true
    echo
    cat /tmp/aca-api-health-db.json 2>/dev/null || true
    echo
    exit 0
  fi
  sleep "$POLL_SEC"
done

echo "::error::API at $BASE did not return 200 for /health and /health/db within ${TIMEOUT_SEC}s"
if [[ -n "$RG" && -n "$APP" ]] && command -v az >/dev/null 2>&1; then
  az containerapp logs show -n "$APP" -g "$RG" --type console --tail 80 || true
  az containerapp replica list -n "$APP" -g "$RG" -o table || true
fi
exit 1
