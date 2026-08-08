#!/usr/bin/env bash
set -euo pipefail

CLICKUP_LIST_ID="${CLICKUP_LIST_ID:-901616287298}"
CLICKUP_TEAM_ID="${CLICKUP_TEAM_ID:-90161394355}"
CLICKUP_API_URL="${CLICKUP_API_URL:-https://api.clickup.com/api/v2}"
HEAD_REF="${HEAD_REF:-${GITHUB_HEAD_REF:-}}"

if [[ -z "${CLICKUP_API_TOKEN:-}" ]]; then
  echo "CLICKUP_API_TOKEN is required" >&2
  exit 1
fi

if [[ "$HEAD_REF" =~ ^(feature|hotfix)/([A-Z][A-Z0-9]*-[0-9]+)- ]]; then
  task_id="${BASH_REMATCH[2]}"
  task_path="/task/$task_id?custom_task_ids=true&team_id=$CLICKUP_TEAM_ID"
elif [[ "$HEAD_REF" =~ ^(feature|hotfix)/([[:alnum:]]+)- ]]; then
  task_id="${BASH_REMATCH[2]}"
  task_path="/task/$task_id"
else
  echo "Branch '$HEAD_REF' does not contain a ClickUp task id; skipping"
  exit 0
fi

request() {
  local method="$1" path="$2" data="${3:-}"
  local args=(-fsS -X "$method" -H "Authorization: $CLICKUP_API_TOKEN" -H "Content-Type: application/json")
  if [[ -n "$data" ]]; then
    args+=(-d "$data")
  fi
  curl "${args[@]}" "$CLICKUP_API_URL$path"
}

task="$(request GET "$task_path")"
readarray -t metadata < <(python3 -c '
import json, sys
task = json.load(sys.stdin)
print(task.get("list", {}).get("id", ""))
print(task.get("status", {}).get("status", ""))
' <<<"$task")

if [[ "${metadata[0]}" != "$CLICKUP_LIST_ID" ]]; then
  echo "Task $task_id is not in the Platform Kit ops list" >&2
  exit 1
fi

if [[ "${metadata[1],,}" == "complete" ]]; then
  echo "Task $task_id is already COMPLETE"
  exit 0
fi

request PUT "$task_path" '{"status":"COMPLETE"}' >/dev/null
echo "Moved ClickUp task $task_id to COMPLETE"
