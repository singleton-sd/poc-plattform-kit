#!/usr/bin/env bash
# Delete PR preview leftovers that are not tied to an open pull request.
#
# Targets:
#   1. Ephemeral ACA apps ssd-pocpk-aca-pr-<n>-ae
#   2. SWA staging environments (web + marketing) except "default"
#   3. ACR tags pocpk-api:pr-<n> / pr-<n>-<sha> for closed PRs
#   4. Entra SPA redirect URIs for closed SWA PR preview origins
#
# Requires: az (logged in), gh, node (for Entra helper).
# Usage:
#   ./scripts/sweep-preview-orphans.sh
#   ./scripts/sweep-preview-orphans.sh --dry-run
#   DRY_RUN=1 ./scripts/sweep-preview-orphans.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

DRY_RUN="${DRY_RUN:-0}"
RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-rg-poc-plattform-kit}"
ACR_NAME="${ACR_NAME:-ssdpocpkacrdevae}"
IMAGE_REPO="${IMAGE_REPO:-pocpk-api}"
WEB_SWA_NAME="${WEB_SWA_NAME:-pocpk-web-si5fhs6dvxiha}"
MKT_SWA_NAME="${MKT_SWA_NAME:-ssd-pocpk-mkt-dev-ae}"
ACA_PREFIX="${ACA_PREFIX:-ssd-pocpk-aca-pr-}"
ACA_SUFFIX="${ACA_SUFFIX:--ae}"
REGION="${SWA_PREVIEW_REGION:-eastasia}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h | --help)
      sed -n '2,16p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

log() { printf '%s\n' "$*"; }
run() {
  if [[ "$DRY_RUN" == "1" ]]; then
    log "DRY-RUN: $*"
    return 0
  fi
  "$@"
}

if ! command -v gh >/dev/null 2>&1; then
  echo "error: gh is required" >&2
  exit 1
fi
if ! command -v az >/dev/null 2>&1; then
  echo "error: az is required" >&2
  exit 1
fi

mapfile -t OPEN_PRS < <(gh pr list --state open --json number --jq '.[].number' | tr -d '\r' | sort -n)
declare -A OPEN_SET=()
for n in "${OPEN_PRS[@]:-}"; do
  [[ -n "$n" ]] && OPEN_SET["$n"]=1
done

log "Open PRs: ${OPEN_PRS[*]:-(none)}"
[[ "$DRY_RUN" == "1" ]] && log "Mode: dry-run (no deletes)"

is_open() {
  [[ -n "${OPEN_SET[$1]:-}" ]]
}

trim() {
  # Azure CLI on Windows Git Bash often emits CR-terminated TSV cells.
  local s="${1//$'\r'/}"
  s="${s#"${s%%[![:space:]]*}"}"
  s="${s%"${s##*[![:space:]]}"}"
  printf '%s' "$s"
}

extract_pr_from_aca() {
  local name="$1"
  local rest="${name#"$ACA_PREFIX"}"
  if [[ "$rest" == "$name" ]]; then
    return 1
  fi
  local pr="${rest%"$ACA_SUFFIX"}"
  if [[ "$pr" == "$rest" || ! "$pr" =~ ^[0-9]+$ ]]; then
    return 1
  fi
  printf '%s\n' "$pr"
  return 0
}

extract_pr_from_acr_tag() {
  local tag="$1"
  if [[ "$tag" =~ ^pr-([0-9]+)(-[0-9a-f]+)?$ ]]; then
    printf '%s\n' "${BASH_REMATCH[1]}"
    return 0
  fi
  return 1
}

# --- 1. ACA ephemeral apps -------------------------------------------------
log ""
log "=== ACA PR preview apps ==="
mapfile -t ACA_APPS < <(
  az containerapp list \
    --resource-group "$RESOURCE_GROUP" \
    --query "[?starts_with(name, '${ACA_PREFIX}')].name" \
    -o tsv 2>/dev/null | tr -d '\r' || true
)
aca_deleted=0
aca_kept=0
for app in "${ACA_APPS[@]:-}"; do
  app="$(trim "$app")"
  [[ -z "$app" ]] && continue
  pr="$(extract_pr_from_aca "$app" || true)"
  if [[ -z "$pr" ]]; then
    log "SKIP  $app (name does not match expected pattern)"
    continue
  fi
  if is_open "$pr"; then
    log "KEEP  $app (open PR #$pr)"
    aca_kept=$((aca_kept + 1))
  else
    log "DELETE $app (PR #$pr not open)"
    run az containerapp delete --name "$app" --resource-group "$RESOURCE_GROUP" --yes
    aca_deleted=$((aca_deleted + 1))
  fi
done
log "ACA summary: deleted=$aca_deleted kept=$aca_kept"

# --- 2. SWA staging environments -------------------------------------------
sweep_swa() {
  local swa_name="$1"
  local label="$2"
  log ""
  log "=== SWA staging ($label: $swa_name) ==="
  local deleted=0 kept=0
  local env_name
  mapfile -t ENVS < <(
    az staticwebapp environment list \
      --name "$swa_name" \
      --resource-group "$RESOURCE_GROUP" \
      --query "[?name!='default'].name" \
      -o tsv 2>/dev/null | tr -d '\r' || true
  )
  for env_name in "${ENVS[@]:-}"; do
    env_name="$(trim "$env_name")"
    [[ -z "$env_name" ]] && continue
    if [[ ! "$env_name" =~ ^[0-9]+$ ]]; then
      log "SKIP  $swa_name/$env_name (non-numeric build id)"
      continue
    fi
    if is_open "$env_name"; then
      log "KEEP  $swa_name/$env_name (open PR)"
      kept=$((kept + 1))
    else
      log "DELETE $swa_name/$env_name (PR not open)"
      run az staticwebapp environment delete \
        --name "$swa_name" \
        --resource-group "$RESOURCE_GROUP" \
        --environment-name "$env_name" \
        --yes
      deleted=$((deleted + 1))
    fi
  done
  log "SWA $label summary: deleted=$deleted kept=$kept"
}

sweep_swa "$WEB_SWA_NAME" "web"
sweep_swa "$MKT_SWA_NAME" "marketing"

# --- 3. ACR image tags -----------------------------------------------------
log ""
log "=== ACR tags ($ACR_NAME/$IMAGE_REPO) ==="
acr_deleted=0
acr_kept=0
mapfile -t TAGS < <(
  az acr repository show-tags \
    --name "$ACR_NAME" \
    --repository "$IMAGE_REPO" \
    -o tsv 2>/dev/null | tr -d '\r' || true
)
for tag in "${TAGS[@]:-}"; do
  tag="$(trim "$tag")"
  [[ -z "$tag" ]] && continue
  pr="$(extract_pr_from_acr_tag "$tag" || true)"
  if [[ -z "$pr" ]]; then
    continue
  fi
  if is_open "$pr"; then
    acr_kept=$((acr_kept + 1))
  else
    log "DELETE ${IMAGE_REPO}:${tag} (PR #$pr not open)"
    run az acr repository delete \
      --name "$ACR_NAME" \
      --image "${IMAGE_REPO}:${tag}" \
      --yes
    acr_deleted=$((acr_deleted + 1))
  fi
done
log "ACR summary: deleted=$acr_deleted kept_open_pr_tags=$acr_kept"

# --- 4. Entra SPA redirect URIs (SWA PR preview origins) -------------------
log ""
log "=== Entra SPA PR preview redirect URIs ==="
ENTRA_MJS="${SCRIPT_DIR}/entra-spa-preview-redirect.mjs"
APP_ID="${ENTRA_SPA_APP_ID:-${NEXT_PUBLIC_AZURE_AD_CLIENT_ID:-}}"
entra_deleted=0
entra_kept=0

if [[ -z "$APP_ID" ]]; then
  log "SKIP  Entra sweep (ENTRA_SPA_APP_ID / NEXT_PUBLIC_AZURE_AD_CLIENT_ID not set)"
elif [[ ! -f "$ENTRA_MJS" ]]; then
  log "SKIP  Entra sweep (helper script missing)"
elif ! command -v node >/dev/null 2>&1; then
  log "SKIP  Entra sweep (node not available)"
else
  object_id="$(az rest --method GET \
    --uri "https://graph.microsoft.com/v1.0/applications(appId='${APP_ID}')?\$select=id,spa" \
    --query id -o tsv 2>/dev/null || true)"
  if [[ -z "$object_id" || "$object_id" == "null" ]]; then
    log "SKIP  Entra sweep (Graph could not resolve appId=${APP_ID})"
  else
    current_json="$(az rest --method GET \
      --uri "https://graph.microsoft.com/v1.0/applications/${object_id}?\$select=spa" \
      -o json 2>/dev/null || true)"
    if [[ -z "$current_json" ]]; then
      log "SKIP  Entra sweep (Graph GET failed)"
    else
      tmp_dir="$(mktemp -d)"
      printf '%s' "$current_json" >"${tmp_dir}/spa.json"
      open_csv="$(IFS=,; echo "${OPEN_PRS[*]:-}")"
      set +e
      plan="$(node "$ENTRA_MJS" sweep-spa "${tmp_dir}/spa.json" "$open_csv" "$REGION" 2>"${tmp_dir}/err.txt")"
      plan_rc=$?
      set -e
      if [[ "$plan_rc" -ne 0 ]]; then
        log "SKIP  Entra sweep (failed to compute plan: $(tr '\n' ' ' <"${tmp_dir}/err.txt"))"
      elif [[ "$plan" == "UNCHANGED" ]]; then
        log "KEEP  no orphan SWA preview redirect URIs"
      else
        remove_count="$(node -e "const p=JSON.parse(process.argv[1]); console.log((p.remove||[]).length)" "$plan")"
        keep_count="$(node -e "const p=JSON.parse(process.argv[1]); console.log((p.keep||[]).length)" "$plan")"
        while IFS= read -r uri; do
          [[ -z "$uri" ]] && continue
          log "DELETE Entra SPA redirect $uri"
        done < <(node -e "const p=JSON.parse(process.argv[1]); for (const u of p.remove||[]) console.log(u)" "$plan")
        next_uris="$(node -e "const p=JSON.parse(process.argv[1]); console.log(JSON.stringify(p.next||[]))" "$plan")"
        printf '{"spa":{"redirectUris":%s}}\n' "$next_uris" >"${tmp_dir}/body.json"
        if [[ "$DRY_RUN" == "1" ]]; then
          log "DRY-RUN: would PATCH applications/${object_id} (remove=$remove_count keep_preview=$keep_count)"
        else
          if az rest --method PATCH \
            --uri "https://graph.microsoft.com/v1.0/applications/${object_id}" \
            --body @"${tmp_dir}/body.json" >/dev/null; then
            log "Updated Entra SPA redirectUris (removed=$remove_count kept_preview=$keep_count)"
          else
            log "SKIP  Entra PATCH failed (check Application.ReadWrite.OwnedBy + ownership)"
            remove_count=0
          fi
        fi
        entra_deleted="$remove_count"
        entra_kept="$keep_count"
      fi
      rm -rf "$tmp_dir"
    fi
  fi
fi
log "Entra summary: deleted=$entra_deleted kept_open_preview=$entra_kept"

log ""
log "Sweep complete."
if [[ "$DRY_RUN" == "1" ]]; then
  log "(dry-run only — re-run without --dry-run to apply)"
fi
