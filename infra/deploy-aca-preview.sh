#!/usr/bin/env bash
# Provision Container Apps Environment + ACR Basic for API PR previews.
#
# Deploys infra/container-apps-preview.bicep into rg-poc-plattform-kit and upserts
# ACR admin credentials into Key Vault (ssd-pocpk-kv-dev-ae). Never commits secrets.
#
# Usage:
#   ./infra/deploy-aca-preview.sh
#   ./infra/deploy-aca-preview.sh --what-if
#   ./infra/deploy-aca-preview.sh --deploy-base-container-app
#   ./infra/deploy-aca-preview.sh --help

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BICEP_FILE="$SCRIPT_DIR/container-apps-preview.bicep"

SUBSCRIPTION_ID="${SUBSCRIPTION_ID:-7b8343d7-969f-4b71-8864-b7925e7fae30}"
RESOURCE_GROUP="${RESOURCE_GROUP:-rg-poc-plattform-kit}"
LOCATION="${LOCATION:-australiaeast}"
KEY_VAULT_NAME="${KEY_VAULT_NAME:-ssd-pocpk-kv-dev-ae}"
ACR_NAME="${ACR_NAME:-ssdpocpkacrdevae}"
CONTAINER_APPS_ENVIRONMENT_NAME="${CONTAINER_APPS_ENVIRONMENT_NAME:-ssd-pocpk-cae-dev-ae}"
DEPLOYMENT_NAME="${DEPLOYMENT_NAME:-pocpk-aca-preview}"

WHAT_IF=0
DEPLOY_BASE_CONTAINER_APP=0

die() { echo "error: $*" >&2; exit 1; }
step() { printf '\n==> %s\n' "$1"; }

usage() {
  cat <<'EOF'
Usage: ./infra/deploy-aca-preview.sh [options]

Options:
  --what-if                      Preview the Bicep deployment only
  --deploy-base-container-app    Also deploy the base container app resource
  --subscription-id ID           Azure subscription
  --resource-group NAME          Resource group (must already exist)
  --location LOC                 Azure region (default: australiaeast)
  --key-vault-name NAME          Key Vault for ACR admin secrets
  --acr-name NAME                ACR name
  --cae-name NAME                Container Apps Environment name
  --deployment-name NAME         ARM deployment name
  -h, --help                     Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --what-if) WHAT_IF=1; shift ;;
    --deploy-base-container-app) DEPLOY_BASE_CONTAINER_APP=1; shift ;;
    --subscription-id) SUBSCRIPTION_ID="${2:?}"; shift 2 ;;
    --resource-group) RESOURCE_GROUP="${2:?}"; shift 2 ;;
    --location) LOCATION="${2:?}"; shift 2 ;;
    --key-vault-name) KEY_VAULT_NAME="${2:?}"; shift 2 ;;
    --acr-name) ACR_NAME="${2:?}"; shift 2 ;;
    --cae-name) CONTAINER_APPS_ENVIRONMENT_NAME="${2:?}"; shift 2 ;;
    --deployment-name) DEPLOYMENT_NAME="${2:?}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown argument: $1 (try --help)" ;;
  esac
done

step 'Checking Azure CLI login'
if ! az account show -o none 2>/dev/null; then
  cat <<EOF
Not logged in to Azure CLI.

Run:
  az login
  az account set --subscription $SUBSCRIPTION_ID
  ./infra/deploy-aca-preview.sh
EOF
  exit 1
fi

step "Setting subscription $SUBSCRIPTION_ID"
az account set --subscription "$SUBSCRIPTION_ID"

step 'Ensuring Microsoft.App / ContainerRegistry providers are registered'
for ns in Microsoft.App Microsoft.ContainerRegistry Microsoft.OperationalInsights; do
  state="$(az provider show -n "$ns" --query registrationState -o tsv 2>/dev/null || echo Unknown)"
  if [[ "$state" != "Registered" ]]; then
    echo "Registering $ns (current: $state)..."
    az provider register -n "$ns" --wait >/dev/null
  else
    echo "$ns already Registered"
  fi
done

rg_exists="$(az group exists --name "$RESOURCE_GROUP" -o tsv)"
if [[ "$rg_exists" != "true" ]]; then
  die "Resource group $RESOURCE_GROUP missing. Run ./infra/deploy.sh first."
fi

deploy_mode=create
[[ "$WHAT_IF" -eq 1 ]] && deploy_mode=what-if
deploy_base_bool=false
[[ "$DEPLOY_BASE_CONTAINER_APP" -eq 1 ]] && deploy_base_bool=true

step "$([[ "$WHAT_IF" -eq 1 ]] && echo 'Running what-if' || echo 'Deploying Container Apps preview stack')"
deploy_out="$(
  az deployment group "$deploy_mode" \
    --name "$DEPLOYMENT_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --template-file "$BICEP_FILE" \
    --parameters \
      "location=$LOCATION" \
      "acrName=$ACR_NAME" \
      "containerAppsEnvironmentName=$CONTAINER_APPS_ENVIRONMENT_NAME" \
      "deployBaseContainerApp=$deploy_base_bool" \
    --output json
)"

if [[ "$WHAT_IF" -eq 1 ]]; then
  echo "$deploy_out"
  exit 0
fi

read -r login_server cae_name cae_domain < <(
  python3 - "$deploy_out" <<'PY'
import json, sys
deployment = json.loads(sys.argv[1])
outputs = deployment.get("properties", {}).get("outputs", {})
def val(name):
    node = outputs.get(name) or {}
    return node.get("value") or ""
print(val("acrLoginServer"), val("containerAppsEnvironmentName"), val("containerAppsEnvironmentDefaultDomain"))
PY
)

step "Upserting ACR credentials into Key Vault $KEY_VAULT_NAME (names only logged)"
creds_json="$(az acr credential show --name "$ACR_NAME" --resource-group "$RESOURCE_GROUP" -o json)"
[[ -n "$creds_json" ]] || die 'Failed to read ACR credentials.'

read -r acr_user acr_pass < <(
  python3 - "$creds_json" <<'PY'
import json, sys
creds = json.loads(sys.argv[1])
user = creds.get("username") or ""
passwords = creds.get("passwords") or []
pwd = passwords[0]["value"] if passwords else ""
print(user, pwd)
PY
)

set_kv_secret() {
  local name="$1" value="$2"
  [[ -n "${value:-}" ]] || return 0
  if az keyvault secret set --vault-name "$KEY_VAULT_NAME" --name "$name" --value "$value" -o none; then
    echo "  set $name"
  else
    echo "  warning: Failed to set $name (check RBAC)" >&2
  fi
}

set_kv_secret 'acr-admin-username' "$acr_user"
set_kv_secret 'acr-admin-password' "$acr_pass"
set_kv_secret 'acr-login-server' "$login_server"
unset acr_pass

step 'Deployment summary (no secrets)'
cat <<EOF
SubscriptionId:            $SUBSCRIPTION_ID
ResourceGroup:             $RESOURCE_GROUP
AcrName:                   $ACR_NAME
AcrLoginServer:            $login_server
ContainerAppsEnvironment:  $cae_name
DefaultDomain:             $cae_domain
EphemeralAppPattern:       ssd-pocpk-aca-pr-<n>-ae
KeyVault:                  $KEY_VAULT_NAME
KeyVaultSecrets:           acr-admin-username, acr-admin-password, acr-login-server
EOF

cat <<'EOF'

Next (human / GitHub) — OIDC only (AZURE_CREDENTIALS / SP-JSON is not supported):
  1. Entra app + federated credential for pull_request (and ID-form subject if needed).
  2. Grant the identity: Contributor on RG + Key Vault Secrets User (ACR admin lives in KV).
  3. Repo Variables (not Secrets): AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_SUBSCRIPTION_ID.
  4. Open an API PR; preview-api.yml OIDC → KV acr-admin-* → docker push + ACA deploy.

EOF
