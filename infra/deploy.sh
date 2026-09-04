#!/usr/bin/env bash
# Provision poc-plattform-kit Azure resources (idempotent Bicep deploy).
#
# Creates RG (if missing) and deploys infra/main.bicep into the target subscription.
#
# Relational database is Neon PostgreSQL (not provisioned here). Set Key Vault
# secrets `database-url` / `database-url-unpooled` from `./scripts/neon-env-pull.sh`
# before or after deploy — this script does not invent a SQL connection string.
#
# Secrets are written to Azure Key Vault. Non-secret config and Key Vault
# references go to Azure App Configuration. Local .env is an optional gitignored
# cache. Never commit .env or secret values. Never put secrets in GitHub Actions
# secrets — pipelines use OIDC → Azure → KV/App Config.
#
# Usage:
#   ./infra/deploy.sh
#   ./infra/deploy.sh --what-if
#   ./infra/deploy.sh --help

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BICEP_FILE="$SCRIPT_DIR/main.bicep"
ENV_FILE="$REPO_ROOT/.env"
ENV_EXAMPLE="$REPO_ROOT/.env.example"

SUBSCRIPTION_ID="${SUBSCRIPTION_ID:-7b8343d7-969f-4b71-8864-b7925e7fae30}"
RESOURCE_GROUP="${RESOURCE_GROUP:-rg-poc-plattform-kit}"
LOCATION="${LOCATION:-australiaeast}"
SWA_LOCATION="${SWA_LOCATION:-eastasia}"
NAME_PREFIX="${NAME_PREFIX:-pocpk}"
KEY_VAULT_NAME="${KEY_VAULT_NAME:-ssd-pocpk-kv-dev-ae}"
APP_CONFIG_NAME="${APP_CONFIG_NAME:-ssd-pocpk-appcs-dev-ae}"
DEPLOYMENT_NAME="${DEPLOYMENT_NAME:-pocpk-infra}"
ALERT_EMAIL="${ALERT_EMAIL:-}"

WHAT_IF=0

PUBLIC_API_URL='https://api.plattform-kit.poc.singletonsd.com'
PUBLIC_APP_URL='https://app.plattform-kit.poc.singletonsd.com'
PUBLIC_MARKETING_URL='https://plattform-kit.poc.singletonsd.com'
CORS_ORIGINS="${PUBLIC_APP_URL},${PUBLIC_MARKETING_URL},https://kind-rock-0f409fe00*.azurestaticapps.net,https://purple-field-05048bf00*.azurestaticapps.net"

die() { echo "error: $*" >&2; exit 1; }
step() { printf '\n==> %s\n' "$1"; }

usage() {
  cat <<'EOF'
Usage: ./infra/deploy.sh [options]

Options:
  --what-if              Preview the Bicep deployment only
  --subscription-id ID   Azure subscription
  --resource-group NAME  Resource group
  --location LOC         Primary Azure region
  --swa-location LOC     Static Web Apps region
  --name-prefix PREFIX   Resource name prefix
  --key-vault-name NAME  Key Vault name
  --app-config-name NAME App Configuration name
  --deployment-name NAME ARM deployment name
  --alert-email EMAIL    Optional alert email for monitors
  -h, --help             Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --what-if) WHAT_IF=1; shift ;;
    --subscription-id) SUBSCRIPTION_ID="${2:?}"; shift 2 ;;
    --resource-group) RESOURCE_GROUP="${2:?}"; shift 2 ;;
    --location) LOCATION="${2:?}"; shift 2 ;;
    --swa-location) SWA_LOCATION="${2:?}"; shift 2 ;;
    --name-prefix) NAME_PREFIX="${2:?}"; shift 2 ;;
    --key-vault-name) KEY_VAULT_NAME="${2:?}"; shift 2 ;;
    --app-config-name) APP_CONFIG_NAME="${2:?}"; shift 2 ;;
    --deployment-name) DEPLOYMENT_NAME="${2:?}"; shift 2 ;;
    --alert-email) ALERT_EMAIL="${2:?}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown argument: $1 (try --help)" ;;
  esac
done

read_dotenv_value() {
  local file="$1" key="$2"
  [[ -f "$file" ]] || return 1
  python3 - "$file" "$key" <<'PY'
import pathlib, re, sys
path, key = sys.argv[1:3]
text = pathlib.Path(path).read_text(encoding="utf-8", errors="replace")
pattern = re.compile(rf"^\s*{re.escape(key)}\s*=\s*(.*)\s*$", re.MULTILINE)
matches = pattern.findall(text)
if not matches:
    sys.exit(1)
value = matches[-1].strip()
if (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'")):
    value = value[1:-1]
print(value)
PY
}

# Reject legacy sqlserver:// (and any non-Postgres) URLs before KV upsert / .env preserve.
assert_postgres_url() {
  local label="$1" url="${2:-}"
  [[ -n "$url" ]] || { echo ""; return 0; }
  if [[ ! "$url" =~ ^[Pp][Oo][Ss][Tt][Gg][Rr][Ee][Ss]([Qq][Ll])?:// ]]; then
    echo "  warning: $label looks like a legacy/non-Postgres URL (expected postgresql:// or postgres://). Skipping." >&2
    echo ""
    return 0
  fi
  printf '%s' "$url"
}

upsert_dotenv_key() {
  local file="$1" key="$2" value="$3"
  python3 - "$file" "$key" "$value" <<'PY'
import pathlib, re, sys
path = pathlib.Path(sys.argv[1])
key, value = sys.argv[2:4]
text = path.read_text(encoding="utf-8", errors="replace") if path.exists() else ""
pattern = re.compile(rf"(?m)^\s*{re.escape(key)}=.*$")
line = f"{key}={value}"
if pattern.search(text):
    text = pattern.sub(line, text, count=1)
else:
    if text and not text.endswith("\n"):
        text += "\n"
    text += line + "\n"
path.write_text(text, encoding="utf-8")
PY
  chmod 600 "$file" 2>/dev/null || true
}

set_kv_secret() {
  local vault="$1" name="$2" value="$3"
  [[ -n "${value:-}" ]] || return 0
  if az keyvault secret set --vault-name "$vault" --name "$name" --value "$value" -o none; then
    echo "  set $name"
  else
    echo "  warning: Failed to set $name (check RBAC / provider registration)" >&2
  fi
}

kv_secret_exists() {
  local vault="$1" name="$2"
  az keyvault secret show --vault-name "$vault" --name "$name" -o none 2>/dev/null
}

set_appconfig_plain() {
  local name="$1" key="$2" value="$3"
  [[ -n "${value:-}" ]] || return 0
  if az appconfig kv set --name "$name" --key "$key" --value "$value" --yes -o none; then
    echo "  set $key"
  fi
}

set_appconfig_kv_ref() {
  local name="$1" key="$2" vault="$3" secret="$4"
  local secret_id="https://${vault}.vault.azure.net/secrets/${secret}"
  if az appconfig kv set-keyvault --name "$name" --key "$key" --secret-identifier "$secret_id" --yes -o none; then
    echo "  kv-ref $key -> $secret"
  fi
}

set_appconfig_kv_ref_if_secret_exists() {
  local name="$1" key="$2" vault="$3" secret="$4"
  if kv_secret_exists "$vault" "$secret"; then
    set_appconfig_kv_ref "$name" "$key" "$vault" "$secret"
  else
    echo "  skip $key (Key Vault secret '$secret' not present yet)"
  fi
}

step 'Checking Azure CLI login'
if ! az account show -o none 2>/dev/null; then
  cat <<EOF
Not logged in to Azure CLI.

Run ONE of:
  az login
  az login --use-device-code

Then re-run this script. The target subscription must be visible:
  az account set --subscription $SUBSCRIPTION_ID
EOF
  exit 1
fi

step "Setting subscription $SUBSCRIPTION_ID"
if ! az account set --subscription "$SUBSCRIPTION_ID"; then
  echo "Subscription $SUBSCRIPTION_ID is not available to the current Azure identity." >&2
  echo "Visible subscriptions:" >&2
  az account list --query '[].{name:name,id:id,tenant:tenantId}' -o table
  cat <<EOF >&2

If you created the subscription under a different Microsoft account/tenant, log in with that account:
  az login --use-device-code
  az account set --subscription $SUBSCRIPTION_ID
  ./infra/deploy.sh
EOF
  exit 1
fi

tenant_id="$(az account show --query tenantId -o tsv)"
sub_name="$(az account show --query name -o tsv)"
sub_id="$(az account show --query id -o tsv)"
echo "Using subscription: $sub_name ($sub_id) tenant $tenant_id"

step "Ensuring resource group $RESOURCE_GROUP in $LOCATION"
rg_exists="$(az group exists --name "$RESOURCE_GROUP" -o tsv)"
if [[ "$rg_exists" == "false" ]]; then
  az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --tags project=poc-plattform-kit environment=poc >/dev/null
else
  echo 'Resource group already exists.'
fi

step 'Resolving deployer object id for Key Vault RBAC'
deployer_object_id="$(az ad signed-in-user show --query id -o tsv 2>/dev/null || true)"
if [[ -z "${deployer_object_id:-}" ]]; then
  echo 'Could not resolve signed-in user object id; KV admin role skipped in Bicep.'
fi

deploy_mode=create
[[ "$WHAT_IF" -eq 1 ]] && deploy_mode=what-if
step "$([[ "$WHAT_IF" -eq 1 ]] && echo 'Running what-if' || echo 'Deploying Bicep')"
deploy_out="$(
  az deployment group "$deploy_mode" \
    --name "$DEPLOYMENT_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --template-file "$BICEP_FILE" \
    --parameters \
      "location=$LOCATION" \
      "swaLocation=$SWA_LOCATION" \
      "namePrefix=$NAME_PREFIX" \
      "keyVaultName=$KEY_VAULT_NAME" \
      "appConfigName=$APP_CONFIG_NAME" \
      "appConfigSku=Free" \
      "deployerObjectId=${deployer_object_id:-}" \
      "appServiceSku=B1" \
      "alertEmail=$ALERT_EMAIL" \
    --output json
)"

if [[ "$WHAT_IF" -eq 1 ]]; then
  echo "$deploy_out"
  exit 0
fi

eval "$(
  python3 - "$deploy_out" <<'PY'
import json, shlex, sys
deployment = json.loads(sys.argv[1])
outputs = deployment.get("properties", {}).get("outputs", {})
def val(name):
    node = outputs.get(name) or {}
    v = node.get("value")
    return "" if v is None else str(v)
mapping = {
    "API_HOST": "webAppHostname",
    "SWA_HOST": "staticWebAppHostname",
    "MARKETING_SWA_HOST": "marketingStaticWebAppHostname",
    "SB_NS": "serviceBusNamespaceName",
    "WEB_APP_NAME": "webAppName",
    "SWA_NAME": "staticWebAppName",
    "MARKETING_SWA_NAME": "marketingStaticWebAppName",
    "KV_NAME_OUT": "keyVaultName",
    "APP_CONFIG_OUT": "appConfigName",
    "APP_CONFIG_ENDPOINT": "appConfigEndpoint",
    "APP_INSIGHTS_NAME_OUT": "applicationInsightsName",
}
for var, key in mapping.items():
    print(f"{var}={shlex.quote(val(key))}")
PY
)"

KV_NAME_OUT="${KV_NAME_OUT:-$KEY_VAULT_NAME}"
APP_CONFIG_OUT="${APP_CONFIG_OUT:-$APP_CONFIG_NAME}"
APP_INSIGHTS_NAME_OUT="${APP_INSIGHTS_NAME_OUT:-ssd-pocpk-appi-dev-ae}"

database_url="$(assert_postgres_url DATABASE_URL "$(read_dotenv_value "$ENV_FILE" DATABASE_URL 2>/dev/null || true)")"
database_url_unpooled="$(assert_postgres_url DATABASE_URL_UNPOOLED "$(read_dotenv_value "$ENV_FILE" DATABASE_URL_UNPOOLED 2>/dev/null || true)")"

step 'Writing local .env (gitignored)'
umask 077
tmp_env="$(mktemp)"
trap 'rm -f "$tmp_env"' EXIT
cat >"$tmp_env" <<EOF
# Generated by infra/deploy.sh — DO NOT COMMIT
AZURE_SUBSCRIPTION_ID=$SUBSCRIPTION_ID
AZURE_TENANT_ID=$tenant_id
AZURE_RESOURCE_GROUP=$RESOURCE_GROUP
AZURE_LOCATION=$LOCATION
# Neon PostgreSQL — set via ./scripts/neon-env-pull.sh then upsert to Key Vault
DATABASE_URL=${database_url:-}
DATABASE_URL_UNPOOLED=${database_url_unpooled:-}
AZURE_APP_SERVICE_NAME=$WEB_APP_NAME
AZURE_APP_SERVICE_URL=$PUBLIC_API_URL
AZURE_STATIC_WEB_APP_NAME=$SWA_NAME
AZURE_STATIC_WEB_APP_URL=$PUBLIC_APP_URL
AZURE_MARKETING_SWA_NAME=$MARKETING_SWA_NAME
AZURE_MARKETING_URL=$PUBLIC_MARKETING_URL
AZURE_SERVICEBUS_NAMESPACE=$SB_NS
AZURE_SERVICEBUS_CONNECTION_STRING=
NEXT_PUBLIC_API_BASE_URL=$PUBLIC_API_URL
CORS_ORIGINS=$CORS_ORIGINS
AUTH_URL=$PUBLIC_API_URL
AUTH_COOKIE_DOMAIN=.plattform-kit.poc.singletonsd.com
AUTH_SECRET=
AZURE_AD_CLIENT_ID=
AZURE_AD_CLIENT_SECRET=
AZURE_AD_TENANT_ID=
AZURE_AD_API_AUDIENCE=
EOF

# Preserve existing AUTH / Entra / Neon / SB values if present
if [[ -f "$ENV_FILE" ]]; then
  for key in AUTH_SECRET AUTH_URL AUTH_COOKIE_DOMAIN AZURE_AD_CLIENT_ID AZURE_AD_CLIENT_SECRET \
    AZURE_AD_TENANT_ID AZURE_AD_API_AUDIENCE AZURE_SERVICEBUS_CONNECTION_STRING \
    DATABASE_URL DATABASE_URL_UNPOOLED; do
    if existing="$(read_dotenv_value "$ENV_FILE" "$key" 2>/dev/null)"; then
      [[ -n "$existing" ]] || continue
      if [[ "$key" == DATABASE_URL || "$key" == DATABASE_URL_UNPOOLED ]]; then
        existing="$(assert_postgres_url "$key" "$existing")"
        [[ -n "$existing" ]] || continue
      fi
      python3 - "$tmp_env" "$key" "$existing" <<'PY'
import pathlib, re, sys
path = pathlib.Path(sys.argv[1])
key, value = sys.argv[2:4]
text = path.read_text(encoding="utf-8")
pattern = re.compile(rf"(?m)^\s*{re.escape(key)}=.*$")
text = pattern.sub(f"{key}={value}", text, count=1)
path.write_text(text, encoding="utf-8")
PY
    fi
  done
fi

chmod 600 "$tmp_env"
mv "$tmp_env" "$ENV_FILE"
chmod 600 "$ENV_FILE"
trap - EXIT

step 'Fetching Service Bus connection string into .env'
sb_cs="$(
  az servicebus namespace authorization-rule keys list \
    --resource-group "$RESOURCE_GROUP" \
    --namespace-name "$SB_NS" \
    --name RootManageSharedAccessKey \
    --query primaryConnectionString -o tsv 2>/dev/null || true
)"
if [[ -n "${sb_cs:-}" ]]; then
  upsert_dotenv_key "$ENV_FILE" AZURE_SERVICEBUS_CONNECTION_STRING "$sb_cs"
fi

# Re-read Neon URLs after preserve (may have been restored from prior .env)
database_url="$(assert_postgres_url DATABASE_URL "$(read_dotenv_value "$ENV_FILE" DATABASE_URL 2>/dev/null || true)")"
database_url_unpooled="$(assert_postgres_url DATABASE_URL_UNPOOLED "$(read_dotenv_value "$ENV_FILE" DATABASE_URL_UNPOOLED 2>/dev/null || true)")"

step "Upserting secrets into Key Vault $KV_NAME_OUT (names only logged)"
if [[ -n "${database_url:-}" ]]; then
  set_kv_secret "$KV_NAME_OUT" 'database-url' "$database_url"
else
  echo '  skip database-url (set via ./scripts/neon-env-pull.sh then re-run, or az keyvault secret set)'
fi
if [[ -n "${database_url_unpooled:-}" ]]; then
  set_kv_secret "$KV_NAME_OUT" 'database-url-unpooled' "$database_url_unpooled"
else
  echo '  skip database-url-unpooled (Prisma migrate directUrl; set from neon env pull)'
fi
if [[ -n "${sb_cs:-}" ]]; then
  set_kv_secret "$KV_NAME_OUT" 'servicebus-connection-string' "$sb_cs"
fi
unset sb_cs database_url database_url_unpooled

step 'Upserting App Insights connection string into Key Vault (name only logged)'
app_insights_cs="$(
  az monitor app-insights component show \
    --app "$APP_INSIGHTS_NAME_OUT" \
    --resource-group "$RESOURCE_GROUP" \
    --query connectionString -o tsv 2>/dev/null || true
)"
if [[ -n "${app_insights_cs:-}" ]]; then
  set_kv_secret "$KV_NAME_OUT" 'appinsights-connection-string' "$app_insights_cs"
  upsert_dotenv_key "$ENV_FILE" APPLICATIONINSIGHTS_CONNECTION_STRING "$app_insights_cs"
  unset app_insights_cs
else
  echo '  skipped appinsights-connection-string (component not found yet)'
fi

step 'Upserting SWA deployment tokens into Key Vault (if available)'
swa_token="$(az staticwebapp secrets list --name "$SWA_NAME" --resource-group "$RESOURCE_GROUP" --query 'properties.apiKey' -o tsv 2>/dev/null || true)"
if [[ -n "${swa_token:-}" ]]; then
  set_kv_secret "$KV_NAME_OUT" 'swa-deployment-token' "$swa_token"
  unset swa_token
else
  echo '  skipped swa-deployment-token (CLI could not read SWA apiKey)'
fi
mkt_token="$(az staticwebapp secrets list --name "$MARKETING_SWA_NAME" --resource-group "$RESOURCE_GROUP" --query 'properties.apiKey' -o tsv 2>/dev/null || true)"
if [[ -n "${mkt_token:-}" ]]; then
  set_kv_secret "$KV_NAME_OUT" 'swa-marketing-deployment-token' "$mkt_token"
  unset mkt_token
else
  echo '  skipped swa-marketing-deployment-token (CLI could not read marketing SWA apiKey)'
fi

step "Seeding App Configuration $APP_CONFIG_OUT (plain keys + KV refs)"
set_appconfig_plain "$APP_CONFIG_OUT" 'app:api:baseUrl' "$PUBLIC_API_URL"
set_appconfig_plain "$APP_CONFIG_OUT" 'app:web:baseUrl' "$PUBLIC_APP_URL"
set_appconfig_plain "$APP_CONFIG_OUT" 'app:marketing:baseUrl' "$PUBLIC_MARKETING_URL"
set_appconfig_plain "$APP_CONFIG_OUT" 'app:cors:origins' "$CORS_ORIGINS"
set_appconfig_plain "$APP_CONFIG_OUT" 'app:throttle:limit' '100'
set_appconfig_plain "$APP_CONFIG_OUT" 'app:throttle:ttlMs' '60000'
set_appconfig_plain "$APP_CONFIG_OUT" 'app:auth:url' "$PUBLIC_API_URL"
set_appconfig_plain "$APP_CONFIG_OUT" 'app:auth:cookieDomain' '.plattform-kit.poc.singletonsd.com'
set_appconfig_plain "$APP_CONFIG_OUT" 'app:web:swaName' "$SWA_NAME"
set_appconfig_plain "$APP_CONFIG_OUT" 'app:marketing:swaName' "$MARKETING_SWA_NAME"
set_appconfig_plain "$APP_CONFIG_OUT" 'app:azure:resourceGroup' "$RESOURCE_GROUP"
set_appconfig_plain "$APP_CONFIG_OUT" 'app:azure:keyVaultName' "$KV_NAME_OUT"
set_appconfig_kv_ref "$APP_CONFIG_OUT" 'secret:database-url' "$KV_NAME_OUT" 'database-url'
set_appconfig_kv_ref "$APP_CONFIG_OUT" 'secret:servicebus-connection-string' "$KV_NAME_OUT" 'servicebus-connection-string'
set_appconfig_kv_ref "$APP_CONFIG_OUT" 'secret:swa-deployment-token' "$KV_NAME_OUT" 'swa-deployment-token'
set_appconfig_kv_ref "$APP_CONFIG_OUT" 'secret:appinsights-connection-string' "$KV_NAME_OUT" 'appinsights-connection-string'
set_appconfig_plain "$APP_CONFIG_OUT" 'app:telemetry:cloudRoleName:api' 'api'
set_appconfig_plain "$APP_CONFIG_OUT" 'app:telemetry:cloudRoleName:web' 'web'
set_appconfig_kv_ref "$APP_CONFIG_OUT" 'secret:swa-marketing-deployment-token' "$KV_NAME_OUT" 'swa-marketing-deployment-token'

set_appconfig_plain "$APP_CONFIG_OUT" 'app:azureAd:clientId' "$(read_dotenv_value "$ENV_FILE" AZURE_AD_CLIENT_ID 2>/dev/null || true)"
set_appconfig_plain "$APP_CONFIG_OUT" 'app:azureAd:tenantId' "$(read_dotenv_value "$ENV_FILE" AZURE_AD_TENANT_ID 2>/dev/null || true)"
set_appconfig_plain "$APP_CONFIG_OUT" 'app:azureAd:apiAudience' "$(read_dotenv_value "$ENV_FILE" AZURE_AD_API_AUDIENCE 2>/dev/null || true)"

auth_secret="$(read_dotenv_value "$ENV_FILE" AUTH_SECRET 2>/dev/null || true)"
if [[ -n "${auth_secret:-}" ]]; then
  set_kv_secret "$KV_NAME_OUT" 'auth-secret' "$auth_secret"
fi
unset auth_secret
ad_client_secret="$(read_dotenv_value "$ENV_FILE" AZURE_AD_CLIENT_SECRET 2>/dev/null || true)"
if [[ -n "${ad_client_secret:-}" ]]; then
  set_kv_secret "$KV_NAME_OUT" 'azure-ad-client-secret' "$ad_client_secret"
fi
unset ad_client_secret

set_appconfig_kv_ref_if_secret_exists "$APP_CONFIG_OUT" 'secret:auth-secret' "$KV_NAME_OUT" 'auth-secret'
set_appconfig_kv_ref_if_secret_exists "$APP_CONFIG_OUT" 'secret:azure-ad-client-secret' "$KV_NAME_OUT" 'azure-ad-client-secret'

upsert_dotenv_key "$ENV_FILE" AZURE_APPCONFIGURATION_ENDPOINT "$APP_CONFIG_ENDPOINT"

if [[ ! -f "$ENV_EXAMPLE" ]]; then
  echo 'Note: .env.example missing — create from template in repo.'
fi

step 'Deployment summary (no secrets)'
cat <<EOF
SubscriptionId:            $SUBSCRIPTION_ID
ResourceGroup:             $RESOURCE_GROUP
Location:                  $LOCATION
Database:                  Neon PostgreSQL (Key Vault database-url)
AppService:                $WEB_APP_NAME
AppServiceUrl:             $PUBLIC_API_URL
AppServiceDefaultHost:     https://$API_HOST
StaticWebApp:              $SWA_NAME
StaticWebAppUrl:           $PUBLIC_APP_URL
StaticWebAppDefaultHost:   https://$SWA_HOST
MarketingSwa:              $MARKETING_SWA_NAME
MarketingUrl:              $PUBLIC_MARKETING_URL
MarketingDefaultHost:      https://$MARKETING_SWA_HOST
ServiceBusNamespace:       $SB_NS
KeyVault:                  $KV_NAME_OUT
AppConfiguration:          $APP_CONFIG_OUT
AppConfigurationEndpoint:  $APP_CONFIG_ENDPOINT
ApplicationInsights:       $APP_INSIGHTS_NAME_OUT
LocalEnvFile:              $ENV_FILE
EOF

cat <<'EOF'

Next steps:
  1. AWS Route53: CNAME marketing/app/api hostnames → Azure defaults (+ TXT validation)
  2. Bind custom domains + managed certs on SWAs and App Service (B1)
  3. Entra app registration (SPA + API) — secrets in Key Vault; config in App Config
  4. Neon: ./scripts/neon-env-pull.sh then upsert DATABASE_URL* into Key Vault (database-url / database-url-unpooled)
  5. Confirm GitHub Variables AZURE_CLIENT_ID / AZURE_TENANT_ID / AZURE_SUBSCRIPTION_ID (OIDC)
  6. Wire App Service / SWA / ACA to App Configuration provider + managed identity
  7. ./infra/migrate-db.sh against Neon (Prisma postgresql)
  8. Never store deploy tokens or connection strings in GitHub Secrets
  9. After cutover validation, delete legacy Azure SQL (#292)

EOF
