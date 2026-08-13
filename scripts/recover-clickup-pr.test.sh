#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

cat > "$TMP/curl" <<'MOCK'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$CALLS_FILE"
case " $* " in
  *' -X POST '*|*' -X PUT '*) printf '{}' ;;
  *) printf '{"list":{"id":"901616287298"},"status":{"status":"ready for human"}}' ;;
esac
MOCK
chmod +x "$TMP/curl"

export PATH="$TMP:$PATH" CALLS_FILE="$TMP/calls" CLICKUP_API_TOKEN=test PR_NUMBER=7 CURL_BIN="$TMP/curl"

cat > "$TMP/gh" <<'MOCK'
#!/usr/bin/env bash
printf '{"headRefName":"feature/86d3test-gate","url":"https://example/pr/7","mergeable":"MERGEABLE","mergeStateStatus":"CLEAN","labels":[{"name":"has-feedback"}],"statusCheckRollup":[]}'
MOCK
chmod +x "$TMP/gh"
: > "$CALLS_FILE"
"$ROOT/scripts/recover-clickup-pr.sh" >/dev/null
grep -Fq '/field/50a8d70c-e3a6-4bd7-8e3d-7661eaf6e6c7' "$CALLS_FILE"
grep -Fq 'READY FOR AI' "$CALLS_FILE"
grep -Fq 'has-feedback' "$CALLS_FILE"

cat > "$TMP/gh" <<'MOCK'
#!/usr/bin/env bash
printf '{"headRefName":"feature/86d3test-gate","url":"https://example/pr/7","mergeable":"MERGEABLE","mergeStateStatus":"CLEAN","labels":[{"name":"preview-blocked"}],"statusCheckRollup":[{"name":"Build and deploy web ACA preview","conclusion":"FAILURE","state":"FAILURE"}]}'
MOCK
chmod +x "$TMP/gh"
: > "$CALLS_FILE"
out="$("$ROOT/scripts/recover-clickup-pr.sh")"
printf '%s\n' "$out" | grep -Fq 'no recovery blockers'
if grep -Fq 'READY FOR AI' "$CALLS_FILE"; then
  echo 'preview-blocked must not bounce ClickUp' >&2
  exit 1
fi

echo 'recover-clickup-pr tests passed'
