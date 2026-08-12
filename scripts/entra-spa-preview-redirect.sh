#!/usr/bin/env bash
# Add or remove a SWA PR preview origin on the Entra SPA redirect URI list.
#
# Requires: az CLI logged in (OIDC in Actions), node.
# Graph: Application.ReadWrite.OwnedBy on the OIDC SP + ownership of the target app.
#
# Usage:
#   scripts/entra-spa-preview-redirect.sh add|remove \
#     --pr <n> \
#     [--origin https://…] \
#     [--app-id <entra-app-id>] \
#     [--swa-name pocpk-web-si5fhs6dvxiha] \
#     [--resource-group rg-poc-plattform-kit] \
#     [--region eastasia]
#
# Soft-fail (exit 0) on Graph permission / lookup errors unless STRICT=1.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HELPER_MJS="${SCRIPT_DIR}/entra-spa-preview-redirect.mjs"

ACTION="${1:-}"
shift || true

PR_NUMBER="${PR_NUMBER:-}"
ORIGIN="${ORIGIN:-}"
APP_ID="${ENTRA_SPA_APP_ID:-${NEXT_PUBLIC_AZURE_AD_CLIENT_ID:-}}"
SWA_NAME="${SWA_NAME:-pocpk-web-si5fhs6dvxiha}"
RESOURCE_GROUP="${RESOURCE_GROUP:-rg-poc-plattform-kit}"
REGION="${SWA_PREVIEW_REGION:-eastasia}"
STRICT="${STRICT:-0}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --pr)
      PR_NUMBER="${2:-}"
      shift 2
      ;;
    --origin)
      ORIGIN="${2:-}"
      shift 2
      ;;
    --app-id)
      APP_ID="${2:-}"
      shift 2
      ;;
    --swa-name)
      SWA_NAME="${2:-}"
      shift 2
      ;;
    --resource-group)
      RESOURCE_GROUP="${2:-}"
      shift 2
      ;;
    --region)
      REGION="${2:-}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

soft_fail() {
  local msg="$1"
  if [[ "$STRICT" == "1" ]]; then
    echo "error: $msg" >&2
    exit 1
  fi
  echo "warning: $msg — skipping Entra SPA redirect update (set STRICT=1 to fail)." >&2
  exit 0
}

if [[ "$ACTION" != "add" && "$ACTION" != "remove" ]]; then
  echo "usage: $0 add|remove --pr <n> [--origin url] [--app-id guid] …" >&2
  exit 2
fi

if [[ -z "$APP_ID" ]]; then
  soft_fail "ENTRA_SPA_APP_ID / NEXT_PUBLIC_AZURE_AD_CLIENT_ID not set"
fi

if [[ -z "$ORIGIN" ]]; then
  if [[ -z "$PR_NUMBER" ]]; then
    soft_fail "--pr or --origin is required"
  fi
  hostname="$(az staticwebapp environment list \
    --name "$SWA_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "[?name=='${PR_NUMBER}'].hostname | [0]" \
    -o tsv 2>/dev/null || true)"
  if [[ -n "$hostname" && "$hostname" != "null" ]]; then
    ORIGIN="https://${hostname}"
  else
    default_host="$(az staticwebapp show \
      --name "$SWA_NAME" \
      --resource-group "$RESOURCE_GROUP" \
      --query defaultHostname \
      -o tsv 2>/dev/null || true)"
    if [[ -z "$default_host" || "$default_host" == "null" ]]; then
      soft_fail "could not resolve SWA defaultHostname for ${SWA_NAME}"
    fi
    ORIGIN="$(node "$HELPER_MJS" build "$default_host" "$PR_NUMBER" "$REGION")" \
      || soft_fail "failed to build preview origin from ${default_host} PR ${PR_NUMBER}"
  fi
fi

ORIGIN="$(node "$HELPER_MJS" normalize "$ORIGIN")" || soft_fail "invalid origin: ${ORIGIN}"

echo "Entra SPA redirect ${ACTION}: ${ORIGIN} (appId=${APP_ID})"

object_id="$(az rest --method GET \
  --uri "https://graph.microsoft.com/v1.0/applications(appId='${APP_ID}')?\$select=id,spa" \
  --query id -o tsv 2>/dev/null || true)"
if [[ -z "$object_id" || "$object_id" == "null" ]]; then
  soft_fail "Graph could not resolve application appId=${APP_ID} (need Application.ReadWrite.OwnedBy + app ownership)"
fi

current_json="$(az rest --method GET \
  --uri "https://graph.microsoft.com/v1.0/applications/${object_id}?\$select=spa" \
  -o json 2>/dev/null || true)"
if [[ -z "$current_json" ]]; then
  soft_fail "Graph GET applications/${object_id} failed"
fi

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
printf '%s' "$current_json" >"${tmp_dir}/spa.json"

next_uris="$(node "$HELPER_MJS" plan "$ACTION" "${tmp_dir}/spa.json" "$ORIGIN")" \
  || soft_fail "failed to compute redirect URI list"

if [[ "$next_uris" == "UNCHANGED" ]]; then
  echo "No change needed for ${ORIGIN}"
  exit 0
fi

printf '{"spa":{"redirectUris":%s}}\n' "$next_uris" >"${tmp_dir}/body.json"

if ! az rest --method PATCH \
  --uri "https://graph.microsoft.com/v1.0/applications/${object_id}" \
  --body @"${tmp_dir}/body.json" >/dev/null; then
  soft_fail "Graph PATCH applications/${object_id} failed (check Application.ReadWrite.OwnedBy + ownership)"
fi

echo "Updated Entra SPA redirectUris (${ACTION} ${ORIGIN})"
