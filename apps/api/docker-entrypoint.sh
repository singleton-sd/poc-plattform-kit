#!/bin/sh
# Preview-image entrypoint (see apps/api/Dockerfile). The image ships an
# immutable, build-time-generated SQLite database template — this script
# copies it to a writable runtime path on every container start, so a
# redeploy (or a fresh cold start after scale-to-zero) always resets the
# preview database back to its deterministic seeded state, and mutations
# made during one container's lifetime never persist across restarts.
set -eu

TEMPLATE_DB="/app/prisma/preview-template.db"
RUNTIME_DB="${PREVIEW_DB_RUNTIME_PATH:-/app/data/preview.db}"

if [ ! -f "$TEMPLATE_DB" ]; then
  echo "docker-entrypoint: missing immutable SQLite template at $TEMPLATE_DB" >&2
  exit 1
fi

mkdir -p "$(dirname "$RUNTIME_DB")"
rm -f "$RUNTIME_DB"
cp "$TEMPLATE_DB" "$RUNTIME_DB"
# The template is intentionally read-only (0444) so the image can never
# mutate its own baked-in seed state; `cp` preserves that mode, so the
# writable runtime copy needs it relaxed explicitly.
chmod 0644 "$RUNTIME_DB"

# Explicit and set before Nest (and app-configuration.ts) start, so the
# shared Azure SQL App Configuration value is never resolved for previews —
# see apps/api/src/config/app-configuration.ts (explicit env vars win).
export DATABASE_URL="file:${RUNTIME_DB}"

# Re-verify the seeded fixtures against the writable copy on every start —
# catches a corrupted/truncated copy before Nest starts serving traffic,
# rather than only trusting the build-time check. Never re-seeds: the
# scenarios were already baked into the template at build time.
SCENARIOS_FILE="/app/prisma/preview-scenarios.txt"
VERIFY_SCRIPT="/app/preview-scripts/db-scripts/seed.mjs"
if [ -f "$SCENARIOS_FILE" ] && [ -f "$VERIFY_SCRIPT" ]; then
  node "$VERIFY_SCRIPT" \
    --verify-only \
    --scenarios="$(cat "$SCENARIOS_FILE")" \
    --database-url="$DATABASE_URL" \
    --client=/app/node_modules/.prisma/client
fi

exec node dist/main.js
