#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

cat > "$TMP/curl" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "$CALLS_FILE"
if [[ "$*" == *"-X GET"* ]]; then
  printf '{"list":{"id":"901616287298"},"status":{"status":"ready for human"}}'
fi
MOCK
chmod +x "$TMP/curl"

export PATH="$TMP:$PATH"
export CALLS_FILE="$TMP/calls"
export CLICKUP_API_TOKEN="test-token"
export HEAD_REF="feature/86d3zdpmw-complete-clickup-after-merge"

"$ROOT/scripts/complete-clickup-on-merge.sh" >/dev/null

grep -Fq -- '-X GET' "$CALLS_FILE"
grep -Fq -- '/task/86d3zdpmw' "$CALLS_FILE"
grep -Fq -- '-X PUT' "$CALLS_FILE"
grep -Fq -- '{"status":"COMPLETE"}' "$CALLS_FILE"

: > "$CALLS_FILE"
HEAD_REF="docs/no-ticket" "$ROOT/scripts/complete-clickup-on-merge.sh" >/dev/null
[[ ! -s "$CALLS_FILE" ]]

echo "complete-clickup-on-merge tests passed"
