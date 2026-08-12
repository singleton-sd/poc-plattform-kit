#!/usr/bin/env bash
# After App Service zip upload: poll /health and fail-fast on *hard* container crashes.
# Avoids `az webapp deploy --track-status true`, which sits forever on
# "Starting the site..." while Nest crash-loops (exit 1) without surfacing logs.
#
# Important: App Service docker.log keeps echoing LastError: ContainerStartupFailure
# on later INFO lines ("container is running", warmup probe, etc.). Matching that
# string alone is a false positive — /health can be fine while logs still mention it.
#
# Requires: az CLI logged in, curl, unzip.
# Env:
#   AZURE_RESOURCE_GROUP  (required)
#   AZURE_WEBAPP_NAME     (required)
#   VERIFY_TIMEOUT_SEC    (default 240)  total wait for /health 200
#   VERIFY_POLL_SEC       (default 15)   health + log poll interval
#   VERIFY_LOG_EVERY      (default 1)    download logs every N polls (1 = each poll)
#   VERIFY_CURL_MAX_TIME  (default 45)   curl --max-time for /health (cold start is slow)
#   VERIFY_LOG_GRACE_SEC  (default 45)   only warn on crashes until this many seconds elapsed
set -euo pipefail

RG="${AZURE_RESOURCE_GROUP:?AZURE_RESOURCE_GROUP required}"
APP="${AZURE_WEBAPP_NAME:?AZURE_WEBAPP_NAME required}"
TIMEOUT_SEC="${VERIFY_TIMEOUT_SEC:-240}"
POLL_SEC="${VERIFY_POLL_SEC:-15}"
LOG_EVERY="${VERIFY_LOG_EVERY:-1}"
CURL_MAX_TIME="${VERIFY_CURL_MAX_TIME:-45}"
LOG_GRACE_SEC="${VERIFY_LOG_GRACE_SEC:-45}"
HEALTH_URL="https://${APP}.azurewebsites.net/health"
WORKDIR="${RUNNER_TEMP:-/tmp}/api-appservice-verify-$$"
LOG_ZIP="$WORKDIR/webapp_logs.zip"
LOG_DIR="$WORKDIR/logs"
# Ignore crash lines older than this (avoids sticky failures from prior deploys).
# Allow 2 minutes before verify start so logs from the just-finished zip push count.
START_EPOCH="$(date -u +%s)"
RECENT_FLOOR_EPOCH=$((START_EPOCH - 120))

mkdir -p "$WORKDIR"
cleanup() { rm -rf "$WORKDIR"; }
trap cleanup EXIT

echo "==> Verify App Service startup: $APP (timeout ${TIMEOUT_SEC}s, poll ${POLL_SEC}s)"
echo "    health: $HEALTH_URL"
echo "    crash log floor (UTC epoch): $RECENT_FLOOR_EPOCH"
echo "    log fail-fast grace: ${LOG_GRACE_SEC}s; curl max-time: ${CURL_MAX_TIME}s"

# Hard crash only — NOT bare "ContainerStartupFailure" (stale LastError on healthy starts).
HARD_CRASH_REGEX='Container has finished running with exit code: [1-9]|Failed to start site\.|terminated during site startup|Site startup probe failed|did not initialize yet|Cannot find module |Error: @prisma|\[Nest\].*ERROR|ContainerStream:.*Error:'

# Lines that look scary but are platform noise / mid-warmup (do not fail-fast).
NOISE_REGEX='LastError: ContainerStartupFailure|Site is blocked due to multiple, consecutive cold start failures|successfully created and is running|WaitingForSiteWarmUpProbeSuccess|Pinging warmup path|InitiatingSiteWarmUpProbe|DetailsLevel: INFO'

line_epoch() {
  local line="$1"
  local ts=""
  if [[ "$line" =~ ([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}) ]]; then
    ts="${BASH_REMATCH[1]}"
    date -u -d "$ts" +%s 2>/dev/null || echo 0
  else
    echo 0
  fi
}

is_hard_crash_line() {
  local line="$1"
  # Drop platform state lines that only echo a previous LastError while starting OK.
  if echo "$line" | grep -Eiq "$NOISE_REGEX"; then
    # Still allow Nest/process errors even if the same line mentions LastError.
    if echo "$line" | grep -Eiq 'ContainerStream:.*Error:|did not initialize yet|Cannot find module |Error: @prisma|\[Nest\].*ERROR|Container has finished running with exit code: [1-9]|Failed to start site\.|terminated during site startup|Site startup probe failed'; then
      return 0
    fi
    return 1
  fi
  echo "$line" | grep -Eiq "$HARD_CRASH_REGEX"
}

extract_crash_excerpt() {
  local search_root="$1"
  local files=()
  local f
  while IFS= read -r -d '' f; do
    files+=("$f")
    if (( ${#files[@]} >= 30 )); then
      break
    fi
  done < <(find "$search_root" -type f \( \
    -name '*docker*.log' -o -name '*failure*.log' -o -name '*default_docker.log' -o -name '*.log' \
  \) -print0 2>/dev/null)

  local hit=1
  local line epoch
  for f in "${files[@]+"${files[@]}"}"; do
    [[ -f "$f" ]] || continue
    local recent_matches=()
    while IFS= read -r line; do
      [[ -z "$line" ]] && continue
      epoch="$(line_epoch "$line")"
      if (( epoch < RECENT_FLOOR_EPOCH )); then
        continue
      fi
      if is_hard_crash_line "$line"; then
        recent_matches+=("$line")
      fi
    done < <(grep -Ein "$HARD_CRASH_REGEX|ContainerStartupFailure" "$f" || true)

    if (( ${#recent_matches[@]} > 0 )); then
      hit=0
      echo "---- hard crash evidence (recent): $f ----"
      printf '%s\n' "${recent_matches[@]}" | tail -n 40
      echo "---- tail: $f ----"
      tail -n 40 "$f" || true
    fi
  done
  return "$hit"
}

download_logs() {
  rm -rf "$LOG_DIR" "$LOG_ZIP"
  mkdir -p "$LOG_DIR"
  # May warn on Linux apps; this resource still returns docker/failure logs.
  if ! az webapp log download \
    --resource-group "$RG" \
    --name "$APP" \
    --log-file "$LOG_ZIP" \
    --only-show-errors 2>"$WORKDIR/log-download.err"
  then
    echo "warning: az webapp log download failed:"
    cat "$WORKDIR/log-download.err" || true
    return 1
  fi
  if [[ ! -s "$LOG_ZIP" ]]; then
    echo "warning: log zip empty"
    return 1
  fi
  unzip -qo "$LOG_ZIP" -d "$LOG_DIR" 2>/dev/null || true
  return 0
}

deadline=$((SECONDS + TIMEOUT_SEC))
attempt=0
last_http="000"

while (( SECONDS < deadline )); do
  attempt=$((attempt + 1))
  elapsed=$((TIMEOUT_SEC - (deadline - SECONDS)))
  code="$(curl -sS -o "$WORKDIR/health.json" -w '%{http_code}' --max-time "$CURL_MAX_TIME" "$HEALTH_URL" || true)"
  last_http="$code"
  echo "hypothesisId=A attempt=$attempt http=$code elapsed=${elapsed}s"

  if [[ "$code" == "200" ]]; then
    cat "$WORKDIR/health.json" || true
    echo
    echo "hypothesisId=A message=health ok"
    exit 0
  fi

  if (( attempt % LOG_EVERY == 0 )); then
    echo "==> Fetching App Service logs (fail-fast on hard container crash only)"
    if download_logs; then
      if extract_crash_excerpt "$LOG_DIR"; then
        if (( elapsed < LOG_GRACE_SEC )); then
          echo "warning: hard crash signature seen during grace (${elapsed}s < ${LOG_GRACE_SEC}s) — keep polling /health"
        else
          echo "::error::App Service container crashed during startup (see log excerpt above). Not waiting out the full timeout — Nest/Kudu is crash-looping."
          echo "hypothesisId=A message=startup crash detected via logs http=$last_http"
          exit 1
        fi
      else
        echo "    no hard crash signature in recent logs (http=$code; stale LastError ignored)"
      fi
    fi
  fi

  sleep "$POLL_SEC"
done

echo "==> /health did not return 200 within ${TIMEOUT_SEC}s (last http=$last_http)"
echo "==> Final log pull for diagnosis"
if download_logs; then
  extract_crash_excerpt "$LOG_DIR" || true
  echo "---- log tree (newest first) ----"
  find "$LOG_DIR" -type f -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -n 20 | while read -r _ path; do
    echo "  $path"
  done || find "$LOG_DIR" -type f | head -n 20
fi
echo "::error::App Service /health not 200 after deploy (last http=$last_http). See log excerpt above."
echo "hypothesisId=A message=health check failed after deploy"
cat "$WORKDIR/health.json" 2>/dev/null || true
exit 1
