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
  printf '{"custom_fields":[{"id":"50a8d70c-e3a6-4bd7-8e3d-7661eaf6e6c7","value":"claim-1"}],"status":{"status":"ready for review"}}'
else
  printf '{}'
fi
printf '\n200'
MOCK
cat > "$TMP/node" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
printf 'gate %s\n' "$*" >> "$CALLS_FILE"
MOCK
cat > "$TMP/gh" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
printf 'https://github.com/singleton-sd/poc-plattform-kit/pull/123'
MOCK
chmod +x "$TMP/curl" "$TMP/node" "$TMP/gh"
export PATH="$TMP:$PATH" CALLS_FILE="$TMP/calls" CLICKUP_API_TOKEN=test
bash "$ROOT/scripts/clickup.sh" handoff 86d3test 123 "READY FOR REVIEW" claim-1 >/dev/null
grep -Fq 'pr-handoff-gate.mjs' "$CALLS_FILE"
grep -Fq 'upsert-pr-review-brief.mjs' "$CALLS_FILE"
grep -Fq 'READY FOR REVIEW' "$CALLS_FILE"
grep -Fq 'pull/123' "$CALLS_FILE"
status_line=$(grep -n -F 'READY FOR REVIEW' "$CALLS_FILE" | tail -1 | cut -d: -f1)
clear_line=$(grep -n -F '/field/50a8d70c-e3a6-4bd7-8e3d-7661eaf6e6c7' "$CALLS_FILE" | tail -1 | cut -d: -f1)
[[ "$status_line" -lt "$clear_line" ]]
if bash "$ROOT/scripts/clickup.sh" handoff 86d3test 123 "READY FOR REVIEW" wrong >/dev/null 2>&1; then
  echo 'expected claim mismatch failure' >&2
  exit 1
fi
echo 'clickup handoff tests passed'
