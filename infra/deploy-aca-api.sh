#!/usr/bin/env bash
# Provision / update the persistent production Nest API Container App.
#
# Deploys infra/container-apps-api-prod.bicep into rg-poc-plattform-kit.
# Requires CAE + ACR from ./infra/deploy-aca-preview.sh (shared PoC environment).
# Does NOT create a second Container Apps Environment or ACR.
#
# Usage:
#   ./infra/deploy-aca-api.sh --image ssdpocpkacrdevae.azurecr.io/pocpk-api:<sha>
#   ./infra/deploy-aca-api.sh --what-if --image ssdpocpkacrdevae.azurecr.io/pocpk-api:<sha>
#   ./infra/deploy-aca-api.sh --help
#
# Cost: minReplicas defaults to 0 (scale to zero). Pass --min-replicas 1 only if you
# intentionally want always-on compute.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BICEP_FILE="$SCRIPT_DIR/container-apps-api-prod.bicep"

SUBSCRIPTION_ID="${SUBSCRIPTION_ID:-7b8343d7-969f-4b71-8864-b7925e7fae30}"
RESOURCE_GROUP="${RESOURCE_GROUP:-rg-poc-plattform-kit}"
LOCATION="${LOCATION:-australiaeast}"
KEY_VAULT_NAME="${KEY_VAULT_NAME:-ssd-pocpk-kv-dev-ae}"
ACR_NAME="${ACR_NAME:-ssdpocpkacrdevae}"
CONTAINER_APPS_ENVIRONMENT_NAME="${CONTAINER_APPS_ENVIRONMENT_NAME:-ssd-pocpk-cae-dev-ae}"
CONTAINER_APP_NAME="${CONTAINER_APP_NAME:-ssd-pocpk-aca-api-dev-ae}"
APP_CONFIG_NAME="${APP_CONFIG_NAME:-ssd-pocpk-appcs-dev-ae}"
APPLICATION_INSIGHTS_NAME="${APPLICATION_INSIGHTS_NAME:-ssd-pocpk-appi-dev-ae}"
SERVICE_BUS_NAMESPACE_NAME="${SERVICE_BUS_NAMESPACE_NAME:-pocpk-sb-si5fhs6dvxiha}"
DEPLOYMENT_NAME="${DEPLOYMENT_NAME:-pocpk-aca-api-prod}"
API_IMAGE="${API_IMAGE:-}"
MIN_REPLICAS="${MIN_REPLICAS:-0}"
MAX_REPLICAS="${MAX_REPLICAS:-2}"

WHAT_IF=0

die() { echo "error: $*" >&2; exit 1; }
step() { printf '\n==> %s\n' "$1"; }

usage() {
  cat <<'EOF'
Usage: ./infra/deploy-aca-api.sh --image <registry/repo:tag> [options]

Options:
  --image REF                    Required. Full image (prefer commit SHA tag)
  --what-if                      Preview the Bicep deployment only
  --min-replicas N               Default 0 (scale to zero). 1 = always-on cost
  --max-replicas N               Default 2
  --subscription-id ID           Azure subscription
  --resource-group NAME          Resource group (must already exist)
  --location LOC                 Azure region (default: australiaeast)
  --key-vault-name NAME          Key Vault for ACR admin password
  --acr-name NAME                ACR name
  --cae-name NAME                Container Apps Environment name
  --app-name NAME                Production Container App name
  --app-config-name NAME         App Configuration store
  --app-insights-name NAME       Application Insights
  --service-bus-name NAME        Service Bus namespace (env AZURE_SERVICEBUS_NAMESPACE)
  --deployment-name NAME         ARM deployment name
  -h, --help                     Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --image) API_IMAGE="${2:?}"; shift 2 ;;
    --what-if) WHAT_IF=1; shift ;;
    --min-replicas) MIN_REPLICAS="${2:?}"; shift 2 ;;
    --max-replicas) MAX_REPLICAS="${2:?}"; shift 2 ;;
    --subscription-id) SUBSCRIPTION_ID="${2:?}"; shift 2 ;;
    --resource-group) RESOURCE_GROUP="${2:?}"; shift 2 ;;
    --location) LOCATION="${2:?}"; shift 2 ;;
    --key-vault-name) KEY_VAULT_NAME="${2:?}"; shift 2 ;;
    --acr-name) ACR_NAME="${2:?}"; shift 2 ;;
    --cae-name) CONTAINER_APPS_ENVIRONMENT_NAME="${2:?}"; shift 2 ;;
    --app-name) CONTAINER_APP_NAME="${2:?}"; shift 2 ;;
    --app-config-name) APP_CONFIG_NAME="${2:?}"; shift 2 ;;
    --app-insights-name) APPLICATION_INSIGHTS_NAME="${2:?}"; shift 2 ;;
    --service-bus-name) SERVICE_BUS_NAMESPACE_NAME="${2:?}"; shift 2 ;;
    --deployment-name) DEPLOYMENT_NAME="${2:?}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown argument: $1 (try --help)" ;;
  esac
done

[[ -n "$API_IMAGE" ]] || die "--image is required (use a commit SHA tag, not latest-only)"

step 'Checking Azure CLI login'
if ! az account show -o none 2>/dev/null; then
  cat <<EOF
Not logged in to Azure CLI.

Run:
  az login
  az account set --subscription $SUBSCRIPTION_ID
  ./infra/deploy-aca-api.sh --image <ref>
EOF
  exit 1
fi

step "Setting subscription $SUBSCRIPTION_ID"
az account set --subscription "$SUBSCRIPTION_ID"

rg_exists="$(az group exists --name "$RESOURCE_GROUP" -o tsv)"
if [[ "$rg_exists" != "true" ]]; then
  die "Resource group $RESOURCE_GROUP missing. Run ./infra/deploy.sh first."
fi

cae_id="$(az containerapp env show -n "$CONTAINER_APPS_ENVIRONMENT_NAME" -g "$RESOURCE_GROUP" --query id -o tsv 2>/dev/null || true)"
[[ -n "$cae_id" ]] || die "CAE $CONTAINER_APPS_ENVIRONMENT_NAME missing. Run ./infra/deploy-aca-preview.sh first."

acr_id="$(az acr show -n "$ACR_NAME" -g "$RESOURCE_GROUP" --query id -o tsv 2>/dev/null || true)"
[[ -n "$acr_id" ]] || die "ACR $ACR_NAME missing. Run ./infra/deploy-aca-preview.sh first."

step "Reading ACR admin password from Key Vault $KEY_VAULT_NAME"
ACR_PASS="$(az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name acr-admin-password --query value -o tsv)"
[[ -n "$ACR_PASS" ]] || die "Key Vault secret acr-admin-password missing"

PARAMS=(
  location="$LOCATION"
  containerAppsEnvironmentName="$CONTAINER_APPS_ENVIRONMENT_NAME"
  containerAppName="$CONTAINER_APP_NAME"
  acrName="$ACR_NAME"
  keyVaultName="$KEY_VAULT_NAME"
  appConfigName="$APP_CONFIG_NAME"
  applicationInsightsName="$APPLICATION_INSIGHTS_NAME"
  serviceBusNamespaceName="$SERVICE_BUS_NAMESPACE_NAME"
  apiImage="$API_IMAGE"
  minReplicas="$MIN_REPLICAS"
  maxReplicas="$MAX_REPLICAS"
  acrAdminPassword="$ACR_PASS"
)

step "Deploying $BICEP_FILE (minReplicas=$MIN_REPLICAS maxReplicas=$MAX_REPLICAS)"
if [[ "$WHAT_IF" -eq 1 ]]; then
  az deployment group what-if \
    --resource-group "$RESOURCE_GROUP" \
    --name "$DEPLOYMENT_NAME" \
    --template-file "$BICEP_FILE" \
    --parameters "${PARAMS[@]}"
  exit 0
fi

az deployment group create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$DEPLOYMENT_NAME" \
  --template-file "$BICEP_FILE" \
  --parameters "${PARAMS[@]}" \
  -o none

FQDN="$(az deployment group show -g "$RESOURCE_GROUP" -n "$DEPLOYMENT_NAME" --query 'properties.outputs.containerAppFqdn.value' -o tsv)"
PRINCIPAL="$(az deployment group show -g "$RESOURCE_GROUP" -n "$DEPLOYMENT_NAME" --query 'properties.outputs.containerAppPrincipalId.value' -o tsv)"

cat <<EOF

Production API Container App ready.

  App:       $CONTAINER_APP_NAME
  URL:       https://$FQDN
  Image:     $API_IMAGE
  Scale:     min=$MIN_REPLICAS max=$MAX_REPLICAS (0 = scale to zero)
  Principal: $PRINCIPAL

Next:
  1. Smoke: curl -sS "https://$FQDN/health" and "/health/db"
  2. Re-run ./infra/deploy-openfga.sh so OpenFGA assigns this ACA managed identity
  3. Keep App Service + DNS until custom-domain cutover is validated
  4. CI: deploy-api.yml builds --target production and updates this app by SHA tag
EOF
