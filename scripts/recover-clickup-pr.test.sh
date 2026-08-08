#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cat > "$TMP/gh" <<'MOCK'
#!/usr/bin/env bash
printf '{"headRefName":"feature/86d3test-gate","url":"https://example/pr/7","mergeable":"MERGEABLE","mergeStateStatus":"CLEAN","labels":[{"name":"has-feedback"}],"statusCheckRollup":[]}'
MOCK
cat > "$TMP/curl" <<'MOCK'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$CALLS_FILE"
if [[ "$*" == *'-X GET'* ]]; then
  printf '{"list":{"id":"901616287298"},"status":{"status":"ready for human"}}'
else
  printf '{}'
fi
MOCK
chmod +x "$TMP/gh" "$TMP/curl"
export PATH="$TMP:$PATH" CALLS_FILE="$TMP/calls" CLICKUP_API_TOKEN=test PR_NUMBER=7
"$ROOT/scripts/recover-clickup-pr.sh" >/dev/null
grep -Fq '/field/50a8d70c-e3a6-4bd7-8e3d-7661eaf6e6c7' "$CALLS_FILE"
grep -Fq 'READY FOR AI' "$CALLS_FILE"
grep -Fq 'has-feedback' "$CALLS_FILE"
echo 'recover-clickup-pr tests passed'
