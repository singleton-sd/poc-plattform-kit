#!/usr/bin/env bash
# Provision OpenFGA on ACA + Neon PostgreSQL, Entra OIDC app, store/model bootstrap.
#
# Idempotent bootstrap for ssd-pocpk-openfga-dev-ae:
#   1. Deploy infra/openfga.bicep (ACA + Neon PostgreSQL datastore on existing CAE)
#   2. Ensure Entra app registration api://{tenantId}/ssd-pocpk-openfga (assignment-required)
#   3. Assign the Nest API App Service managed identity as the sole app-role assignee
#   4. Create/reuse OpenFGA store, push infra/openfga/model.json
#   5. Seed App Configuration app:openfga:* keys read by apps/api
#
# Safe to re-run. Never commits secrets. Prefer Azure CLI login / GitHub OIDC
# (same Variables as preview-api.yml) - no AZURE_CREDENTIALS / SP-JSON.
#
# Usage:
#   ./infra/deploy-openfga.sh --what-if
#   ./infra/deploy-openfga.sh
#   ./infra/deploy-openfga.sh --skip-entra --skip-bootstrap

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BICEP_FILE="$SCRIPT_DIR/openfga.bicep"
MODEL_JSON_FILE="$SCRIPT_DIR/openfga/model.json"
MODEL_FGA_FILE="$SCRIPT_DIR/openfga/model.fga"

SUBSCRIPTION_ID="${SUBSCRIPTION_ID:-7b8343d7-969f-4b71-8864-b7925e7fae30}"
RESOURCE_GROUP="${RESOURCE_GROUP:-rg-poc-plattform-kit}"
LOCATION="${LOCATION:-australiaeast}"
CONTAINER_APPS_ENVIRONMENT_NAME="${CONTAINER_APPS_ENVIRONMENT_NAME:-ssd-pocpk-cae-dev-ae}"
OPENFGA_APP_NAME="${OPENFGA_APP_NAME:-ssd-pocpk-openfga-dev-ae}"
KEY_VAULT_NAME="${KEY_VAULT_NAME:-ssd-pocpk-kv-dev-ae}"
NEON_BRANCH="${NEON_BRANCH:-production}"
NEON_OPENFGA_DATABASE="${NEON_OPENFGA_DATABASE:-openfga}"
APP_CONFIG_NAME="${APP_CONFIG_NAME:-ssd-pocpk-appcs-dev-ae}"
API_WEBAPP_NAME="${API_WEBAPP_NAME:-pocpk-api-si5fhs6dvxiha}"
OPENFGA_IMAGE_TAG="${OPENFGA_IMAGE_TAG:-v1.18.3}"
OPENFGA_AUDIENCE="${OPENFGA_AUDIENCE:-api://9a0e57d7-e58e-4e8b-814d-037cd7d9015c/ssd-pocpk-openfga}"
OPENFGA_APP_DISPLAY_NAME="${OPENFGA_APP_DISPLAY_NAME:-ssd-pocpk-openfga}"
STORE_NAME="${STORE_NAME:-poc-plattform-kit}"
DEPLOYMENT_NAME="${DEPLOYMENT_NAME:-pocpk-openfga}"
APP_ROLE_VALUE="${APP_ROLE_VALUE:-OpenFga.Access}"

WHAT_IF=0
SKIP_ENTRA=0
SKIP_BOOTSTRAP=0

OPENFGA_API_URL=''
OPENFGA_FQDN=''
APP_CLIENT_ID=''
STORE_ID=''
MODEL_ID=''

die() { echo "error: $*" >&2; exit 1; }

step() { printf '\n==> %s\n' "$1"; }

assert_az() {
  local code=$?
  local action="$1"
  if [[ $# -ge 2 ]]; then
    action="$1"
    code="$2"
  fi
  if [[ "$code" -ne 0 ]]; then
    die "$action failed (exit $code)."
  fi
}

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

get_neon_openfga_datastore_uris() {
  local env_file="$REPO_ROOT/.env"
  local runtime migrate
  if runtime="$(read_dotenv_value "$env_file" OPENFGA_DATASTORE_URI 2>/dev/null)" \
    && migrate="$(read_dotenv_value "$env_file" OPENFGA_DATASTORE_URI_UNPOOLED 2>/dev/null)"; then
    echo 'Using OpenFGA datastore URIs from repo .env' >&2
    printf '%s\n%s\n' "$runtime" "$migrate"
    return 0
  fi

  echo "Resolving Neon OpenFGA URIs via neon CLI (branch=$NEON_BRANCH, database=$NEON_OPENFGA_DATABASE)" >&2
  cd "$REPO_ROOT"
  migrate="$(npx neon connection-string "$NEON_BRANCH" --database-name "$NEON_OPENFGA_DATABASE" 2>/dev/null | tail -1 | tr -d '\r')"
  runtime="$(npx neon connection-string "$NEON_BRANCH" --database-name "$NEON_OPENFGA_DATABASE" --pooled 2>/dev/null | tail -1 | tr -d '\r')"
  [[ -n "$runtime" && -n "$migrate" ]] || die "Could not resolve Neon OpenFGA connection strings. Run ./scripts/neon-env-pull.sh (or set OPENFGA_DATASTORE_URI / OPENFGA_DATASTORE_URI_UNPOOLED in repo .env) and retry."
  printf '%s\n%s\n' "$runtime" "$migrate"
}

set_keyvault_secret() {
  local name="$1" value="$2"
  az keyvault secret set --vault-name "$KEY_VAULT_NAME" --name "$name" --value "$value" -o none
  assert_az "az keyvault secret set $name"
  echo "  upserted Key Vault secret $name"
}

write_parameters_file() {
  local path="$1" tenant_id="$2" runtime_uri="$3" migrate_uri="$4"
  python3 - "$path" "$LOCATION" "$CONTAINER_APPS_ENVIRONMENT_NAME" "$OPENFGA_APP_NAME" "$OPENFGA_IMAGE_TAG" \
    "$tenant_id" "$OPENFGA_AUDIENCE" "$migrate_uri" "$runtime_uri" <<'PY'
import json, pathlib, sys
path, location, cae, app_name, image_tag, tenant_id, audience, migrate_uri, runtime_uri = sys.argv[1:10]
payload = {
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        "location": {"value": location},
        "containerAppsEnvironmentName": {"value": cae},
        "openfgaAppName": {"value": app_name},
        "openfgaImageTag": {"value": image_tag},
        "oidcIssuer": {"value": f"https://login.microsoftonline.com/{tenant_id}/v2.0"},
        "oidcIssuerAlias": {"value": f"https://sts.windows.net/{tenant_id}/"},
        "openfgaAudience": {"value": audience},
        "openfgaDatastoreUriMigrate": {"value": migrate_uri},
        "openfgaDatastoreUriRuntime": {"value": runtime_uri},
    },
}
pathlib.Path(path).write_text(json.dumps(payload), encoding="utf-8")
PY
  chmod 600 "$path"
}

wait_openfga_healthy() {
  step 'Waiting for OpenFGA /healthz'
  local i
  for i in $(seq 1 36); do
    if curl -sf --max-time 10 "$OPENFGA_API_URL/healthz" >/dev/null; then
      return 0
    fi
    sleep 5
  done
  die "OpenFGA did not become healthy at $OPENFGA_API_URL/healthz"
}

set_openfga_authn_method() {
  local method="$1"
  local best_effort="${2:-0}"
  echo "Setting OPENFGA_AUTHN_METHOD=$method on $OPENFGA_APP_NAME"
  if ! az containerapp update \
    --name "$OPENFGA_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --set-env-vars "OPENFGA_AUTHN_METHOD=$method" \
    -o none; then
    if [[ "$best_effort" -eq 1 ]]; then
      echo "warning: containerapp update authn=$method failed - OpenFGA may still be unauthenticated" >&2
      return 0
    fi
    die "containerapp update authn=$method failed."
  fi
  wait_openfga_healthy
  if [[ "$method" == 'none' ]]; then
    echo 'Waiting for unauthenticated /stores (authn=none revision)'
    for i in $(seq 1 36); do
      if curl -sf --max-time 15 "$OPENFGA_API_URL/stores" >/dev/null; then
        return 0
      fi
      sleep 5
    done
    die 'OpenFGA authn=none revision did not expose /stores without a bearer token.'
  fi
}

openfga_api() {
  local method="$1" path="$2" body="${3:-}"
  local url="${OPENFGA_API_URL}${path}"
  if [[ -n "$body" ]]; then
    curl -sfS -X "$method" "$url" \
      -H 'Accept: application/json' \
      -H 'Content-Type: application/json' \
      --data-binary "$body"
  else
    curl -sfS -X "$method" "$url" -H 'Accept: application/json'
  fi
}

ensure_entra_app() {
  step "Ensuring Entra app registration $OPENFGA_AUDIENCE"
  local existing_app_json app_id app_object_id app_role_id sp_object_id
  local app_full_json tmp_roles needs_update has_assignment tmp_body
  local api_identity_json api_principal_id assignments_json sp_json

  existing_app_json="$(az ad app list --filter "displayName eq '$OPENFGA_APP_DISPLAY_NAME'" --query '[0]' -o json 2>/dev/null || true)"
  if [[ -z "$existing_app_json" || "$existing_app_json" == 'null' ]]; then
    echo "Creating app registration $OPENFGA_APP_DISPLAY_NAME..."
    existing_app_json="$(az ad app create \
      --display-name "$OPENFGA_APP_DISPLAY_NAME" \
      --identifier-uris "$OPENFGA_AUDIENCE" \
      --sign-in-audience AzureADMyOrg \
      -o json)"
    assert_az 'az ad app create'
  else
    app_id="$(printf '%s' "$existing_app_json" | python3 -c 'import json,sys; print(json.load(sys.stdin)["appId"])')"
    echo "App registration already exists ($app_id)"
    needs_update="$(printf '%s' "$existing_app_json" | python3 -c '
import json, sys
audience = sys.argv[1]
app = json.load(sys.stdin)
print("yes" if audience not in (app.get("identifierUris") or []) else "no")
' "$OPENFGA_AUDIENCE")"
    if [[ "$needs_update" == 'yes' ]]; then
      az ad app update --id "$app_id" --identifier-uris "$OPENFGA_AUDIENCE" -o none
      assert_az 'az ad app update identifier-uris'
    fi
  fi

  app_id="$(printf '%s' "$existing_app_json" | python3 -c 'import json,sys; print(json.load(sys.stdin)["appId"])')"
  APP_CLIENT_ID="$app_id"

  app_full_json="$(az ad app show --id "$app_id" -o json)"
  assert_az 'az ad app show'
  app_object_id="$(printf '%s' "$app_full_json" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')"

  tmp_roles="$(mktemp "${TMPDIR:-/tmp}/openfga-approles.XXXXXX.json")"
  chmod 600 "$tmp_roles"
  app_role_id="$(printf '%s' "$app_full_json" | python3 -c '
import json, sys, uuid
app_role_value, out_path = sys.argv[1:3]
app = json.load(sys.stdin)
existing = next((r for r in app.get("appRoles") or [] if r.get("value") == app_role_value), None)
if existing:
    print(existing["id"])
    sys.exit(0)
new_id = str(uuid.uuid4())
roles = [{
    "allowedMemberTypes": ["Application"],
    "description": "Call OpenFGA Check/Write APIs",
    "displayName": "OpenFGA Access",
    "id": new_id,
    "isEnabled": True,
    "value": app_role_value,
}]
for role in app.get("appRoles") or []:
    if role.get("value") != app_role_value:
        roles.append({
            "allowedMemberTypes": list(role.get("allowedMemberTypes") or []),
            "description": role.get("description"),
            "displayName": role.get("displayName"),
            "id": role.get("id"),
            "isEnabled": bool(role.get("isEnabled", True)),
            "value": role.get("value"),
        })
with open(out_path, "w", encoding="utf-8") as fh:
    json.dump({"appRoles": roles}, fh)
print(new_id)
' "$APP_ROLE_VALUE" "$tmp_roles")"
  if [[ -s "$tmp_roles" ]]; then
    az rest --method PATCH \
      --url "https://graph.microsoft.com/v1.0/applications/$app_object_id" \
      --headers 'Content-Type=application/json' \
      --body "@$tmp_roles" \
      -o none
    assert_az 'set OpenFGA app roles via Microsoft Graph'
    echo "Created app role $APP_ROLE_VALUE ($app_role_id)"
  else
    echo "App role $APP_ROLE_VALUE already present ($app_role_id)"
  fi
  rm -f "$tmp_roles"

  sp_json="$(az ad sp list --filter "appId eq '$app_id'" --query '[0]' -o json 2>/dev/null || true)"
  if [[ -z "$sp_json" || "$sp_json" == 'null' ]]; then
    sp_json="$(az ad sp create --id "$app_id" -o json)"
    assert_az 'az ad sp create'
  fi
  sp_object_id="$(printf '%s' "$sp_json" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')"

  echo 'Setting enterprise app assignmentRequired=true'
  az ad sp update --id "$sp_object_id" --set appRoleAssignmentRequired=true -o none
  assert_az 'az ad sp update appRoleAssignmentRequired'

  step "Assigning API App Service MI ($API_WEBAPP_NAME) as sole OpenFGA client"
  api_identity_json="$(az webapp identity show --name "$API_WEBAPP_NAME" --resource-group "$RESOURCE_GROUP" -o json)"
  assert_az 'az webapp identity show'
  api_principal_id="$(printf '%s' "$api_identity_json" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("principalId") or "")')"
  [[ -n "$api_principal_id" ]] || die "App Service $API_WEBAPP_NAME has no system-assigned managed identity."

  assignments_json="$(az rest --method GET \
    --url "https://graph.microsoft.com/v1.0/servicePrincipals/$sp_object_id/appRoleAssignedTo" \
    -o json)"
  assert_az 'list appRoleAssignedTo'

  has_assignment="$(printf '%s' "$assignments_json" | python3 -c '
import json, sys
api_principal_id, app_role_id = sys.argv[1:3]
assignments = json.load(sys.stdin).get("value") or []
print("yes" if any(a.get("principalId") == api_principal_id and a.get("appRoleId") == app_role_id for a in assignments) else "no")
' "$api_principal_id" "$app_role_id")"
  if [[ "$has_assignment" != 'yes' ]]; then
    tmp_body="$(mktemp "${TMPDIR:-/tmp}/openfga-assign.XXXXXX.json")"
    chmod 600 "$tmp_body"
    python3 - "$api_principal_id" "$sp_object_id" "$app_role_id" >"$tmp_body" <<'PY'
import json, sys
principal_id, resource_id, app_role_id = sys.argv[1:4]
print(json.dumps({"principalId": principal_id, "resourceId": resource_id, "appRoleId": app_role_id}))
PY
    az rest --method POST \
      --url "https://graph.microsoft.com/v1.0/servicePrincipals/$sp_object_id/appRoleAssignedTo" \
      --headers 'Content-Type=application/json' \
      --body "@$tmp_body" \
      -o none
    assert_az 'assign API managed identity to OpenFGA app role'
    rm -f "$tmp_body"
    echo "Assigned MI $api_principal_id -> $APP_ROLE_VALUE"
  else
    echo "API MI already assigned ($api_principal_id)"
  fi

  printf '%s' "$assignments_json" | python3 -c '
import json, subprocess, sys
api_principal_id, sp_object_id = sys.argv[1:3]
assignments = json.load(sys.stdin).get("value") or []
for assignment in assignments:
    if assignment.get("principalId") != api_principal_id:
        assignment_id = assignment.get("id")
        principal_id = assignment.get("principalId")
        display = assignment.get("principalDisplayName") or ""
        print(f"Removing unexpected assignee {principal_id} ({display})")
        result = subprocess.run(
            [
                "az", "rest", "--method", "DELETE",
                "--url", f"https://graph.microsoft.com/v1.0/servicePrincipals/{sp_object_id}/appRoleAssignedTo/{assignment_id}",
                "-o", "none",
            ],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            print(f"warning: Could not remove assignee {principal_id}", file=sys.stderr)
' "$api_principal_id" "$sp_object_id"
}

bootstrap_store_and_model() {
  local stores_json existing_store_id created_json write_body written_json bootstrap_err=0

  restore_openfga_oidc() {
    step 'Restoring OPENFGA_AUTHN_METHOD=oidc'
    set_openfga_authn_method oidc 1 || bootstrap_err=1
  }
  trap restore_openfga_oidc EXIT

  wait_openfga_healthy
  step 'Bootstrap window: OPENFGA_AUTHN_METHOD=none (store + model only)'
  set_openfga_authn_method none 0

  step "Ensuring OpenFGA store '$STORE_NAME'"
  stores_json="$(openfga_api GET '/stores')"
  existing_store_id="$(printf '%s' "$stores_json" | python3 -c '
import json, sys
store_name = sys.argv[1]
stores = json.load(sys.stdin).get("stores") or []
match = next((s for s in stores if s.get("name") == store_name), None)
print(match["id"] if match else "")
' "$STORE_NAME")"
  if [[ -n "$existing_store_id" ]]; then
    STORE_ID="$existing_store_id"
    echo "Reusing store $STORE_ID"
  else
    created_json="$(openfga_api POST '/stores' "{\"name\":\"$STORE_NAME\"}")"
    STORE_ID="$(printf '%s' "$created_json" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')"
    echo "Created store $STORE_ID"
  fi

  step 'Pushing authorization model (model.json from model.fga)'
  write_body="$(python3 - "$MODEL_JSON_FILE" <<'PY'
import json, pathlib, sys
model = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))
body = {
    "schema_version": model["schema_version"],
    "type_definitions": model["type_definitions"],
}
if model.get("conditions"):
    body["conditions"] = model["conditions"]
print(json.dumps(body))
PY
)"
  written_json="$(openfga_api POST "/stores/$STORE_ID/authorization-models" "$write_body")"
  MODEL_ID="$(printf '%s' "$written_json" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("authorization_model_id") or "")')"
  [[ -n "$MODEL_ID" ]] || bootstrap_err=1
  if [[ "$bootstrap_err" -eq 0 ]]; then
    echo "Authorization model id: $MODEL_ID"
  else
    echo 'error: OpenFGA did not return authorization_model_id.' >&2
  fi

  step 'Restoring OPENFGA_AUTHN_METHOD=oidc'
  trap - EXIT
  restore_openfga_oidc

  [[ "$bootstrap_err" -eq 0 ]] || die 'Bootstrap failed before App Config could be updated.'
  [[ -n "$STORE_ID" && -n "$MODEL_ID" ]] || die 'Bootstrap did not produce storeId/modelId; App Config not updated.'

  step "Seeding App Configuration $APP_CONFIG_NAME (app:openfga:*)"
  for kv in \
    "app:openfga:apiUrl=$OPENFGA_API_URL" \
    "app:openfga:storeId=$STORE_ID" \
    "app:openfga:authorizationModelId=$MODEL_ID" \
    "app:openfga:audience=$OPENFGA_AUDIENCE"; do
    local key="${kv%%=*}" value="${kv#*=}"
    az appconfig kv set --name "$APP_CONFIG_NAME" --key "$key" --value "$value" --yes -o none
    assert_az "appconfig set $key"
    echo "  set $key"
  done
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --what-if) WHAT_IF=1; shift ;;
      --skip-entra) SKIP_ENTRA=1; shift ;;
      --skip-bootstrap) SKIP_BOOTSTRAP=1; shift ;;
      -h|--help)
        sed -n '2,17p' "$0"
        exit 0
        ;;
      *) die "Unknown argument: $1 (try --help)" ;;
    esac
  done
}

main() {
  parse_args "$@"

  command -v az >/dev/null 2>&1 || die 'Azure CLI (az) is required.'
  command -v curl >/dev/null 2>&1 || die 'curl is required.'
  command -v python3 >/dev/null 2>&1 || die 'python3 is required.'

  step 'Checking Azure CLI login'
  if ! az account show -o json >/dev/null 2>&1; then
    cat <<'EOF'
Not logged in to Azure CLI.

Run (interactive) or use GitHub OIDC Variables (same as preview-api.yml):
  az login
  az account set --subscription 7b8343d7-969f-4b71-8864-b7925e7fae30
  ./infra/deploy-openfga.sh
EOF
    exit 1
  fi

  step "Setting subscription $SUBSCRIPTION_ID"
  az account set --subscription "$SUBSCRIPTION_ID"
  assert_az 'az account set'

  local entra_tenant_id
  entra_tenant_id="$(az account show --query tenantId -o tsv)"
  [[ -n "$entra_tenant_id" ]] || die 'Could not resolve Entra tenant ID from az account show.'
  echo "Entra tenant: $entra_tenant_id"

  step 'Ensuring Microsoft.App / Storage providers are registered'
  local ns state
  for ns in Microsoft.App Microsoft.Storage Microsoft.OperationalInsights; do
    state="$(az provider show -n "$ns" --query registrationState -o tsv 2>/dev/null || true)"
    if [[ "$state" != 'Registered' ]]; then
      echo "Registering $ns (current: ${state:-unknown})..."
      az provider register -n "$ns" --wait >/dev/null
    else
      echo "$ns already Registered"
    fi
  done

  [[ "$(az group exists --name "$RESOURCE_GROUP" -o tsv)" == 'true' ]] \
    || die "Resource group $RESOURCE_GROUP missing. Run ./infra/deploy.sh first."

  if ! az containerapp env show -n "$CONTAINER_APPS_ENVIRONMENT_NAME" -g "$RESOURCE_GROUP" -o none 2>/dev/null; then
    die "CAE $CONTAINER_APPS_ENVIRONMENT_NAME missing. Run ./infra/deploy-aca-preview.sh first."
  fi

  [[ -f "$BICEP_FILE" ]] || die "Missing $BICEP_FILE"
  [[ -f "$MODEL_JSON_FILE" ]] || die "Missing $MODEL_JSON_FILE (companion to $MODEL_FGA_FILE)"

  local uri_lines runtime_uri migrate_uri parameters_file deploy_mode deploy_out deploy_code
  mapfile -t uri_lines < <(get_neon_openfga_datastore_uris)
  runtime_uri="${uri_lines[0]:-}"
  migrate_uri="${uri_lines[1]:-}"
  [[ -n "$runtime_uri" && -n "$migrate_uri" ]] || die 'Resolved empty OpenFGA datastore URIs.'
  [[ "$runtime_uri" == postgres* || "$runtime_uri" == postgresql* ]] \
    || die 'Resolved runtime datastore URI is not a PostgreSQL connection string.'
  [[ "$migrate_uri" == postgres* || "$migrate_uri" == postgresql* ]] \
    || die 'Resolved migrate datastore URI is not a PostgreSQL connection string.'

  if [[ "$WHAT_IF" -eq 0 ]]; then
    step "Upserting OpenFGA datastore secrets in Key Vault $KEY_VAULT_NAME (values not logged)"
    set_keyvault_secret openfga-database-url "$runtime_uri"
    set_keyvault_secret openfga-database-url-unpooled "$migrate_uri"
  fi

  if [[ "$WHAT_IF" -eq 1 ]]; then
    step 'Running what-if'
    deploy_mode='what-if'
  else
    step 'Deploying OpenFGA Container App (Neon PostgreSQL)'
    deploy_mode='create'
  fi

  parameters_file="$(mktemp "${TMPDIR:-/tmp}/openfga-params.XXXXXX.json")"
  chmod 600 "$parameters_file"
  cleanup_parameters_file() {
    rm -f "$parameters_file"
  }
  trap cleanup_parameters_file EXIT
  write_parameters_file "$parameters_file" "$entra_tenant_id" "$runtime_uri" "$migrate_uri"

  set +e
  deploy_out="$(az deployment group "$deploy_mode" \
    --name "$DEPLOYMENT_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --template-file "$BICEP_FILE" \
    --parameters "@$parameters_file" \
    --output json)"
  deploy_code=$?
  set -e
  trap - EXIT
  cleanup_parameters_file
  assert_az 'OpenFGA Bicep deployment' "$deploy_code"

  if [[ "$WHAT_IF" -eq 1 ]]; then
    printf '%s\n' "$deploy_out"
    echo 'WhatIf complete - no Entra / store bootstrap.'
    exit 0
  fi

  OPENFGA_API_URL="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["properties"]["outputs"]["openfgaApiUrl"]["value"])' <<<"$deploy_out")"
  OPENFGA_FQDN="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["properties"]["outputs"]["openfgaFqdn"]["value"])' <<<"$deploy_out")"
  echo "OpenFGA URL: $OPENFGA_API_URL"

  if [[ "$SKIP_ENTRA" -eq 0 ]]; then
    ensure_entra_app
  fi

  if [[ "$SKIP_BOOTSTRAP" -eq 0 ]]; then
    bootstrap_store_and_model
  fi

  step 'Deployment summary (no secrets)'
  cat <<EOF
SubscriptionId     : $SUBSCRIPTION_ID
ResourceGroup      : $RESOURCE_GROUP
ContainerApp       : $OPENFGA_APP_NAME
Fqdn               : $OPENFGA_FQDN
ApiUrl             : $OPENFGA_API_URL
Image              : openfga/openfga:$OPENFGA_IMAGE_TAG
DatastoreEngine    : postgres (Neon openfga database; minReplicas=1)
KeyVaultSecrets    : openfga-database-url, openfga-database-url-unpooled
Audience           : $OPENFGA_AUDIENCE
EntraAppId         : ${APP_CLIENT_ID:-}
StoreId            : ${STORE_ID:-}
AuthorizationModel : ${MODEL_ID:-}
AppConfig          : $APP_CONFIG_NAME
ModelDsl           : $MODEL_FGA_FILE

Next:
  1. Restart Nest API so it reloads App Config (az webapp restart -n $API_WEBAPP_NAME -g $RESOURCE_GROUP).
  2. PermissionsService acquires MI tokens for api://{tenantId}/ssd-pocpk-openfga/.default.
  3. Grant/Revoke + tuple sync remain separate tickets.

OIDC CI note: run this script from a principal logged in via the same GitHub OIDC
Variables as preview-api.yml (AZURE_CLIENT_ID / TENANT_ID / SUBSCRIPTION_ID). Never
put deploy tokens or AZURE_CREDENTIALS in GitHub Secrets.
EOF
}

main "$@"
