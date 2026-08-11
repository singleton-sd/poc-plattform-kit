#!/usr/bin/env bash
# ClickUp REST CLI (bash) — Linux / Cursor Cloud fallback when PowerShell is absent.
# Auth: CLICKUP_API_TOKEN (never print it). Default Delivery list 901616287298
# (override with CLICKUP_LIST_ID for Ideas & Discovery 901616397764 or
# Human & Operations 901616397767).
#
# Usage:
#   ./scripts/clickup.sh me
#   ./scripts/clickup.sh list "READY FOR AI"
#   CLICKUP_LIST_ID=901616397764 ./scripts/clickup.sh list
#   ./scripts/clickup.sh get 86d3xxxx
#   ./scripts/clickup.sh claim 86d3xxxx <claimToken> ["IN PROGRESS"]
#   ./scripts/clickup.sh status 86d3xxxx "READY FOR REVIEW" [--clear-claim] [--url URL]
#   ./scripts/clickup.sh handoff 86d3xxxx <pr> "READY FOR REVIEW" <claimToken>
#   ./scripts/clickup.sh comment 86d3xxxx "text"
#   ./scripts/clickup.sh field 86d3xxxx <fieldId> <value>
#   ./scripts/clickup.sh preview 86d3xxxx https://...
#   ./scripts/clickup.sh create "Title" ["BACKLOG"] [estimate]
#   ./scripts/clickup.sh depend <childId> <parentId>

set -euo pipefail

LIST_ID="${CLICKUP_LIST_ID:-901616287298}"
CLAIM_FIELD_ID='50a8d70c-e3a6-4bd7-8e3d-7661eaf6e6c7'
PREVIEW_FIELD_ID='978d43d5-e404-4262-98a2-0193ade4736d'
ESTIMATE_FIELD_ID='ab22f8d4-df04-435e-849a-9ca6c23489be'
API='https://api.clickup.com/api/v2'

die() { echo "error: $*" >&2; exit 1; }

token() {
  if [[ -n "${CLICKUP_API_TOKEN:-}" ]]; then
    printf '%s' "$CLICKUP_API_TOKEN"
    return
  fi
  die "CLICKUP_API_TOKEN not set. Export a personal API token and retry."
}

# Usage: api METHOD PATH [json_body]
api() {
  local method="$1" path="$2" body="${3:-}"
  local url="$API$path"
  local args=(-sS -X "$method" -H "Authorization: $(token)" -H "Content-Type: application/json" -w '\n%{http_code}')
  if [[ -n "$body" ]]; then
    args+=(-d "$body")
  fi
  local resp
  resp="$(curl "${args[@]}" "$url")" || die "curl failed for $method $path"
  local code="${resp##*$'\n'}"
  local data="${resp%$'\n'*}"
  if [[ "$code" == "429" ]]; then
    die "ClickUp rate limited (429). Stop ClickUp calls in this chat; do not spin."
  fi
  if [[ ! "$code" =~ ^2 ]]; then
    die "ClickUp $method $path failed ($code): $data"
  fi
  printf '%s' "$data"
}

field_value() {
  local task_json="$1" field_id="$2"
  printf '%s' "$task_json" | python3 -c '
import json,sys
tid=sys.argv[1]
t=json.load(sys.stdin)
for f in t.get("custom_fields") or []:
  if f.get("id")==tid:
    v=f.get("value")
    print("" if v is None else v)
    break
' "$field_id"
}

claim_empty() {
  local v="${1:-}"
  [[ -z "${v// }" ]]
}

cmd="${1:-}"
shift || true

case "$cmd" in
  me)
    api GET /user | python3 -c 'import json,sys; u=json.load(sys.stdin)["user"]; print(json.dumps({"id":u["id"],"username":u["username"]},separators=(",",":")))'
    ;;
  list)
    status="${1:-}"
    qs="page=0"
    if [[ -n "$status" ]]; then
      enc="$(python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))' "$status")"
      qs="$qs&statuses%5B%5D=$enc"
    fi
    data="$(api GET "/list/$LIST_ID/task?$qs")"
    printf '%s' "$data" | python3 -c '
import json,sys
status=sys.argv[1]
claim_id=sys.argv[2]
payload=json.load(sys.stdin)
rows=[]
for t in payload.get("tasks") or []:
  claim=None
  for f in t.get("custom_fields") or []:
    if f.get("id")==claim_id:
      claim=f.get("value")
      break
  if status.startswith("READY FOR ") and claim not in (None,""):
    continue
  rows.append({
    "id": t.get("id"),
    "name": t.get("name"),
    "status": (t.get("status") or {}).get("status"),
    "url": t.get("url"),
    "assignees": ", ".join(a.get("username","") for a in (t.get("assignees") or [])),
    "claim_token": claim,
    "preview_url": next((f.get("value") for f in (t.get("custom_fields") or []) if f.get("id")==sys.argv[3]), None),
  })
print(json.dumps(rows, indent=2))
' "$status" "$CLAIM_FIELD_ID" "$PREVIEW_FIELD_ID"
    ;;
  get)
    task_id="${1:-}"; [[ -n "$task_id" ]] || die "get requires task id"
    data="$(api GET "/task/$task_id?include_subtasks=false")"
    printf '%s' "$data" | python3 -c '
import json,sys
claim_id, preview_id = sys.argv[1], sys.argv[2]
t=json.load(sys.stdin)
def fv(fid):
  for f in t.get("custom_fields") or []:
    if f.get("id")==fid: return f.get("value")
  return None
out={
  "id": t.get("id"),
  "name": t.get("name"),
  "status": (t.get("status") or {}).get("status"),
  "url": t.get("url"),
  "description": t.get("description"),
  "markdown_description": t.get("markdown_description"),
  "assignees": [{"id":a.get("id"),"username":a.get("username"),"email":a.get("email")} for a in (t.get("assignees") or [])],
  "custom_fields": [{"id":f.get("id"),"name":f.get("name"),"type":f.get("type"),"value":f.get("value")} for f in (t.get("custom_fields") or [])],
  "dependencies": t.get("dependencies"),
  "linked_tasks": t.get("linked_tasks"),
  "claim_token": fv(claim_id),
  "preview_url": fv(preview_id),
}
print(json.dumps(out, indent=2))
' "$CLAIM_FIELD_ID" "$PREVIEW_FIELD_ID"
    ;;
  claim)
    task_id="${1:-}"; claim_token="${2:-}"; status="${3:-}"
    [[ -n "$task_id" && -n "$claim_token" ]] || die "claim requires task id and claim token"
    before="$(api GET "/task/$task_id")"
    existing="$(field_value "$before" "$CLAIM_FIELD_ID")"
    if ! claim_empty "$existing" && [[ "$existing" != "$claim_token" ]]; then
      die "Claim refused: task $task_id already claimed by '$existing'. Abort and pick another ticket."
    fi
    api POST "/task/$task_id/field/$CLAIM_FIELD_ID" "$(python3 -c 'import json,sys; print(json.dumps({"value":sys.argv[1]}))' "$claim_token")" >/dev/null
    if [[ -n "$status" ]]; then
      api PUT "/task/$task_id" "$(python3 -c 'import json,sys; print(json.dumps({"status":sys.argv[1]}))' "$status")" >/dev/null
    fi
    verify="$(api GET "/task/$task_id")"
    got="$(field_value "$verify" "$CLAIM_FIELD_ID")"
    [[ "$got" == "$claim_token" ]] || die "Claim race lost: expected '$claim_token', got '$got'."
    printf '%s' "$verify" | python3 -c '
import json,sys
claim_id=sys.argv[1]; preview_id=sys.argv[2]
t=json.load(sys.stdin)
def fv(fid):
  for f in t.get("custom_fields") or []:
    if f.get("id")==fid: return f.get("value")
  return None
print(json.dumps({
  "id": t.get("id"),
  "name": t.get("name"),
  "status": (t.get("status") or {}).get("status"),
  "url": t.get("url"),
  "assignees": ", ".join(a.get("username","") for a in (t.get("assignees") or [])),
  "claim_token": fv(claim_id),
  "preview_url": fv(preview_id),
}, indent=2))
' "$CLAIM_FIELD_ID" "$PREVIEW_FIELD_ID"
    ;;
  handoff)
    task_id="${1:-}"; pr_number="${2:-}"; status="${3:-}"; claim_token="${4:-}"
    [[ -n "$task_id" && -n "$pr_number" && -n "$status" && -n "$claim_token" ]] || \
      die "handoff requires task id, PR number, status, and claim token"
    before="$(api GET "/task/$task_id")"
    existing="$(field_value "$before" "$CLAIM_FIELD_ID")"
    [[ "$existing" == "$claim_token" ]] || \
      die "Handoff refused: claim token mismatch for task $task_id"
    repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
    node "$repo_root/scripts/pr-handoff-gate.mjs" --pr "$pr_number"
    node "$repo_root/scripts/upsert-pr-review-brief.mjs" --pr "$pr_number"
    pr_url="$(gh pr view "$pr_number" --json url --jq .url)"
    api POST "/task/$task_id/field/$PREVIEW_FIELD_ID" \
      "$(python3 -c 'import json,sys; print(json.dumps({"value":sys.argv[1]}))' "$pr_url")" >/dev/null
    # Preserve the exclusive claim until the status transition succeeds.
    api PUT "/task/$task_id" \
      "$(python3 -c 'import json,sys; print(json.dumps({"status":sys.argv[1]}))' "$status")" >/dev/null
    verify="$(api GET "/task/$task_id")"
    got_status="$(printf '%s' "$verify" | python3 -c 'import json,sys; print((json.load(sys.stdin).get("status") or {}).get("status", "").lower())')"
    [[ "$got_status" == "${status,,}" ]] || \
      die "Handoff verification failed: expected status '$status', got '$got_status'; claim retained"
    api POST "/task/$task_id/field/$CLAIM_FIELD_ID" '{"value":""}' >/dev/null
    echo "OK: PR gate passed; $task_id -> $status"
    ;;
  status)
    task_id="${1:-}"; status="${2:-}"; shift 2 || true
    [[ -n "$task_id" && -n "$status" ]] || die "status requires task id and status"
    clear_claim=0
    url=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --clear-claim) clear_claim=1 ;;
        --url) url="${2:-}"; shift ;;
        *) die "unknown status flag: $1" ;;
      esac
      shift
    done
    if [[ "$clear_claim" -eq 1 ]]; then
      api POST "/task/$task_id/field/$CLAIM_FIELD_ID" '{"value":""}' >/dev/null
    fi
    if [[ -n "$url" ]]; then
      api POST "/task/$task_id/field/$PREVIEW_FIELD_ID" "$(python3 -c 'import json,sys; print(json.dumps({"value":sys.argv[1]}))' "$url")" >/dev/null
    fi
    api PUT "/task/$task_id" "$(python3 -c 'import json,sys; print(json.dumps({"status":sys.argv[1]}))' "$status")" >/dev/null
    echo "OK: $task_id -> $status"
    ;;
  comment)
    task_id="${1:-}"; text="${2:-}"
    [[ -n "$task_id" && -n "$text" ]] || die "comment requires task id and text"
    api POST "/task/$task_id/comment" "$(python3 -c 'import json,sys; print(json.dumps({"comment_text":sys.argv[1]}))' "$text")"
    echo
    ;;
  field)
    task_id="${1:-}"; field_id="${2:-}"; value="${3:-}"
    [[ -n "$task_id" && -n "$field_id" ]] || die "field requires task id, field id, value"
    api POST "/task/$task_id/field/$field_id" "$(python3 -c 'import json,sys; print(json.dumps({"value":sys.argv[1]}))' "$value")" >/dev/null
    echo "OK field $field_id on $task_id"
    ;;
  preview)
    task_id="${1:-}"; url="${2:-}"
    [[ -n "$task_id" && -n "$url" ]] || die "preview requires task id and url"
    api POST "/task/$task_id/field/$PREVIEW_FIELD_ID" "$(python3 -c 'import json,sys; print(json.dumps({"value":sys.argv[1]}))' "$url")" >/dev/null
    echo "OK Preview URL on $task_id"
    ;;
  create)
    name="${1:-}"; status="${2:-TO DO}"; estimate="${3:-}"
    [[ -n "$name" ]] || die "create requires name"
    created="$(api POST "/list/$LIST_ID/task" "$(python3 -c 'import json,sys; print(json.dumps({"name":sys.argv[1],"status":sys.argv[2]}))' "$name" "$status")")"
    tid="$(printf '%s' "$created" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')"
    if [[ -n "$estimate" ]]; then
      api POST "/task/$tid/field/$ESTIMATE_FIELD_ID" "$(python3 -c 'import json,sys; print(json.dumps({"value":sys.argv[1]}))' "$estimate")" >/dev/null
    fi
    printf '%s' "$created" | python3 -c 'import json,sys; t=json.load(sys.stdin); print(json.dumps({"id":t["id"],"name":t["name"],"status":t["status"]["status"],"url":t["url"]}, indent=2))'
    ;;
  depend)
    task_id="${1:-}"; depends_on="${2:-}"
    [[ -n "$task_id" && -n "$depends_on" ]] || die "depend requires child and parent task ids"
    api POST "/task/$task_id/dependency" "$(python3 -c 'import json,sys; print(json.dumps({"depends_on":sys.argv[1]}))' "$depends_on")" >/dev/null
    echo "OK: $task_id waiting_on $depends_on"
    ;;
  ""|-h|--help|help)
    sed -n '1,20p' "$0"
    ;;
  *)
    die "unknown command: $cmd (see scripts/clickup.sh header)"
    ;;
esac
