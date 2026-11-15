#!/usr/bin/env bash
# Previously added/removed SWA PR preview origins on the Entra SPA redirect
# URI list. Keycloak clients are owned by Singleton Auth (ADR 0006), so this
# helper is a no-op. Preview workflows still call it so they stay green.
#
# The Graph helper in entra-spa-preview-redirect.mjs remains for unit tests
# of origin parsing; do not call it from this script.

set -euo pipefail

echo "skip: Keycloak OIDC clients are owned by Singleton Auth; Entra SPA redirect updates are disabled (ADR 0006)."
exit 0
