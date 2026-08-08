#!/usr/bin/env bash
set -euo pipefail

CLICKUP_LIST_ID="${CLICKUP_LIST_ID:-901616287298}"
CLICKUP_TEAM_ID="${CLICKUP_TEAM_ID:-90161394355}"
CLICKUP_API_URL="${CLICKUP_API_URL:-https://api.clickup.com/api/v2}"
CLAIM_FIELD_ID='50a8d70c-e3a6-4bd7-8e3d-7661eaf6e6c7'
PR_NUMBER="${PR_NUMBER:-}"

[[ -n "${CLICKUP_API_TOKEN:-}" ]] || { echo 'CLICKUP_API_TOKEN is required' >&2; exit 1; }
[[ -n "$PR_NUMBER" ]] || { echo 'PR_NUMBER is required' >&2; exit 1; }

pr_json="$(gh pr view "$PR_NUMBER" --json headRefName,labels,mergeable,mergeStateStatus,statusCheckRollup,url)"
readarray -t pr_data < <(python3 -c '
import json,sys
p=json.load(sys.stdin)
labels={x["name"] for x in p.get("labels",[])}
checks=p.get("statusCheckRollup") or []
failed=[(x.get("name") or x.get("context") or "unknown") for x in checks if (x.get("conclusion") or x.get("state") or "").upper() in {"ACTION_REQUIRED","CANCELLED","FAILURE","STALE","STARTUP_FAILURE","TIMED_OUT"}]
block=sorted(labels & {"needs-rebase","ci-failed","has-feedback"})
if p.get("mergeable")=="CONFLICTING" or p.get("mergeStateStatus")=="DIRTY": block.append("merge-conflict")
block.extend("failed:"+x for x in failed if x != "pr-handoff-gate")
print(p.get("headRefName", ""))
print(p.get("url", ""))
print(", ".join(block))
' <<<"$pr_json")
head_ref="${pr_data[0]}" pr_url="${pr_data[1]}" blockers="${pr_data[2]}"

if [[ -z "$blockers" ]]; then
  echo "PR #$PR_NUMBER has no recovery blockers"
  exit 0
fi

if [[ "$head_ref" =~ ^(feature|hotfix)/([A-Z][A-Z0-9]*-[0-9]+)- ]]; then
  task_id="${BASH_REMATCH[2]}"
  task_path="/task/$task_id?custom_task_ids=true&team_id=$CLICKUP_TEAM_ID"
elif [[ "$head_ref" =~ ^(feature|hotfix)/([[:alnum:]]+)- ]]; then
  task_id="${BASH_REMATCH[2]}"
  task_path="/task/$task_id"
else
  echo "Branch '$head_ref' has no ClickUp task id; skip"
  exit 0
fi

request() {
  local method="$1" path="$2" data="${3:-}"
  local args=(-fsS -X "$method" -H "Authorization: $CLICKUP_API_TOKEN" -H 'Content-Type: application/json')
  [[ -z "$data" ]] || args+=(-d "$data")
  curl "${args[@]}" "$CLICKUP_API_URL$path"
}

task="$(request GET "$task_path")"
readarray -t task_data < <(python3 -c '
import json,sys
t=json.load(sys.stdin)
print(t.get("list",{}).get("id",""))
print(t.get("status",{}).get("status","").lower())
' <<<"$task")
[[ "${task_data[0]}" == "$CLICKUP_LIST_ID" ]] || { echo "Task $task_id is outside ops list" >&2; exit 1; }
case "${task_data[1]}" in
  'ready for review'|'ready for human') ;;
  *) echo "Task $task_id is ${task_data[1]}; no review handoff to recover"; exit 0 ;;
esac

request POST "/task/$task_id/field/$CLAIM_FIELD_ID" '{"value":""}' >/dev/null
request PUT "$task_path" '{"status":"READY FOR AI"}' >/dev/null
marker="[pr-recovery:$PR_NUMBER]"
comment="$marker PR returned to READY FOR AI. Blockers: $blockers. $pr_url"
request POST "/task/$task_id/comment" "$(python3 -c 'import json,sys; print(json.dumps({"comment_text":sys.argv[1]}))' "$comment")" >/dev/null
echo "Moved ClickUp task $task_id to READY FOR AI: $blockers"
