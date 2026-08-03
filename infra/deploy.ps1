<#
.SYNOPSIS
  Provision poc-plattform-kit Azure resources (idempotent Bicep deploy).

.DESCRIPTION
  Creates RG (if missing), generates a SQL admin password once (saved to local .env),
  and deploys infra/main.bicep into the target subscription.

  Secrets are written to Azure Key Vault (locked store) and mirrored to repo-root
  .env (gitignored) for local convenience. Never commit .env or secret values.

.EXAMPLE
  pwsh ./infra/deploy.ps1
  pwsh ./infra/deploy.ps1 -SubscriptionId '7b8343d7-969f-4b71-8864-b7925e7fae30'
#>

[CmdletBinding()]
param(
  [string]$SubscriptionId = '7b8343d7-969f-4b71-8864-b7925e7fae30',
  [string]$ResourceGroup = 'rg-poc-plattform-kit',
  [string]$Location = 'australiaeast',
  [string]$SwaLocation = 'eastasia',
  [string]$NamePrefix = 'pocpk',
  [string]$KeyVaultName = 'ssd-pocpk-kv-dev-ae',
  [string]$DeploymentName = 'pocpk-infra',
  [switch]$WhatIf
)

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$bicepFile = Join-Path $PSScriptRoot 'main.bicep'
$envFile = Join-Path $repoRoot '.env'
$envExample = Join-Path $repoRoot '.env.example'

function Write-Step([string]$Message) {
  Write-Host "`n==> $Message" -ForegroundColor Cyan
}

Write-Step 'Checking Azure CLI login'
$accountJson = az account show -o json 2>$null
if (-not $accountJson) {
  Write-Host @'
Not logged in to Azure CLI.

Run ONE of:
  az login
  az login --use-device-code

Then re-run this script. The target subscription must be visible:
  az account set --subscription 7b8343d7-969f-4b71-8864-b7925e7fae30
'@ -ForegroundColor Yellow
  exit 1
}

Write-Step "Setting subscription $SubscriptionId"
az account set --subscription $SubscriptionId
if ($LASTEXITCODE -ne 0) {
  Write-Host @"
Subscription $SubscriptionId is not available to the current Azure identity.

Visible subscriptions:
"@ -ForegroundColor Red
  az account list --query '[].{name:name,id:id,tenant:tenantId}' -o table
  Write-Host @'

If you created the subscription under a different Microsoft account/tenant, log in with that account:
  az login --use-device-code
  az account set --subscription 7b8343d7-969f-4b71-8864-b7925e7fae30
  pwsh ./infra/deploy.ps1
'@ -ForegroundColor Yellow
  exit 1
}

$sub = az account show -o json | ConvertFrom-Json
Write-Host "Using subscription: $($sub.name) ($($sub.id)) tenant $($sub.tenantId)"

Write-Step "Ensuring resource group $ResourceGroup in $Location"
$rgExists = az group exists --name $ResourceGroup -o tsv
if ($rgExists -eq 'false') {
  az group create --name $ResourceGroup --location $Location --tags project=poc-plattform-kit environment=poc | Out-Null
} else {
  Write-Host "Resource group already exists."
}

Write-Step 'Resolving SQL admin password (local .env only)'
$sqlPassword = $null
$sqlLogin = 'pocpkadmin'

if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*AZURE_SQL_ADMIN_PASSWORD=(.+)\s*$') {
      $sqlPassword = $Matches[1].Trim().Trim('"').Trim("'")
    }
    if ($_ -match '^\s*AZURE_SQL_ADMIN_LOGIN=(.+)\s*$') {
      $sqlLogin = $Matches[1].Trim().Trim('"').Trim("'")
    }
  }
}

if ([string]::IsNullOrWhiteSpace($sqlPassword)) {
  # Azure SQL password complexity: 8+ chars, 3 of 4 character classes
  $bytes = New-Object byte[] 24
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $sqlPassword = 'Pk!' + [Convert]::ToBase64String($bytes).Replace('+', 'A').Replace('/', 'B').Substring(0, 20) + '9a'
  Write-Host 'Generated new SQL admin password (will write to .env).'
} else {
  Write-Host 'Reusing SQL admin password from existing .env.'
}

Write-Step 'Resolving deployer object id for Key Vault RBAC'
$deployerObjectId = ''
try {
  $deployerObjectId = (az ad signed-in-user show --query id -o tsv 2>$null)
} catch {
  Write-Host 'Could not resolve signed-in user object id; KV admin role skipped in Bicep.'
}

Write-Step $(if ($WhatIf) { 'Running what-if' } else { 'Deploying Bicep' })
$deployArgs = @(
  'deployment', 'group', $(if ($WhatIf) { 'what-if' } else { 'create' }),
  '--name', $DeploymentName,
  '--resource-group', $ResourceGroup,
  '--template-file', $bicepFile,
  '--parameters',
  "location=$Location",
  "swaLocation=$SwaLocation",
  "namePrefix=$NamePrefix",
  "keyVaultName=$KeyVaultName",
  "deployerObjectId=$deployerObjectId",
  "appServiceSku=F1",
  "sqlAdminLogin=$sqlLogin",
  "sqlAdminPassword=$sqlPassword",
  '--output', 'json'
)

$deployOut = & az @deployArgs
if ($LASTEXITCODE -ne 0) {
  Write-Error 'Deployment failed.'
  exit $LASTEXITCODE
}

if ($WhatIf) {
  Write-Host $deployOut
  exit 0
}

$deployment = $deployOut | ConvertFrom-Json
$outputs = $deployment.properties.outputs

function Get-Out([string]$Name) {
  return $outputs.$Name.value
}

$sqlFqdn = Get-Out 'sqlServerFqdn'
$dbName = Get-Out 'sqlDatabaseName'
$apiHost = Get-Out 'webAppHostname'
$swaHost = Get-Out 'staticWebAppHostname'
$sbNs = Get-Out 'serviceBusNamespaceName'
$sqlServerName = Get-Out 'sqlServerName'
$webAppName = Get-Out 'webAppName'
$swaName = Get-Out 'staticWebAppName'

# Prisma sqlserver connection string (password URL-encoded)
$encPassword = [uri]::EscapeDataString($sqlPassword)
$databaseUrl = "sqlserver://${sqlFqdn}:1433;database=${dbName};user=${sqlLogin};password=${encPassword};encrypt=true;trustServerCertificate=false"

Write-Step 'Writing local .env (gitignored)'
$envLines = @(
  '# Generated by infra/deploy.ps1 — DO NOT COMMIT',
  "AZURE_SUBSCRIPTION_ID=$SubscriptionId",
  "AZURE_TENANT_ID=$($sub.tenantId)",
  "AZURE_RESOURCE_GROUP=$ResourceGroup",
  "AZURE_LOCATION=$Location",
  "AZURE_SQL_SERVER=$sqlServerName",
  "AZURE_SQL_SERVER_FQDN=$sqlFqdn",
  "AZURE_SQL_DATABASE=$dbName",
  "AZURE_SQL_ADMIN_LOGIN=$sqlLogin",
  "AZURE_SQL_ADMIN_PASSWORD=$sqlPassword",
  "DATABASE_URL=$databaseUrl",
  "AZURE_APP_SERVICE_NAME=$webAppName",
  "AZURE_APP_SERVICE_URL=https://$apiHost",
  "AZURE_STATIC_WEB_APP_NAME=$swaName",
  "AZURE_STATIC_WEB_APP_URL=https://$swaHost",
  "AZURE_SERVICEBUS_NAMESPACE=$sbNs",
  'AZURE_SERVICEBUS_CONNECTION_STRING=',
  'NEXT_PUBLIC_API_BASE_URL=https://' + $apiHost,
  'AUTH_SECRET=',
  'AZURE_AD_CLIENT_ID=',
  'AZURE_AD_CLIENT_SECRET=',
  'AZURE_AD_TENANT_ID='
)

# Preserve existing AUTH / Entra values if present
if (Test-Path $envFile) {
  $existing = Get-Content $envFile -Raw
  foreach ($key in @('AUTH_SECRET', 'AZURE_AD_CLIENT_ID', 'AZURE_AD_CLIENT_SECRET', 'AZURE_AD_TENANT_ID', 'AZURE_SERVICEBUS_CONNECTION_STRING')) {
    if ($existing -match "(?m)^\s*$key=(.*)$") {
      $val = $Matches[1].Trim()
      if ($val) {
        $envLines = $envLines | ForEach-Object {
          if ($_ -match "^$key=") { "$key=$val" } else { $_ }
        }
      }
    }
  }
}

Set-Content -Path $envFile -Value ($envLines -join "`n") -Encoding utf8

# Fetch Service Bus connection string into .env (not into git)
Write-Step 'Fetching Service Bus connection string into .env'
$sbCs = az servicebus namespace authorization-rule keys list `
  --resource-group $ResourceGroup `
  --namespace-name $sbNs `
  --name RootManageSharedAccessKey `
  --query primaryConnectionString -o tsv
if ($sbCs) {
  (Get-Content $envFile) | ForEach-Object {
    if ($_ -match '^AZURE_SERVICEBUS_CONNECTION_STRING=') { "AZURE_SERVICEBUS_CONNECTION_STRING=$sbCs" } else { $_ }
  } | Set-Content $envFile -Encoding utf8
}

$kvNameOut = Get-Out 'keyVaultName'
if (-not $kvNameOut) { $kvNameOut = $KeyVaultName }

Write-Step "Upserting secrets into Key Vault $kvNameOut (names only logged)"
function Set-KvSecret([string]$SecretName, [string]$SecretValue) {
  if ([string]::IsNullOrWhiteSpace($SecretValue)) { return }
  az keyvault secret set --vault-name $kvNameOut --name $SecretName --value $SecretValue -o none
  if ($LASTEXITCODE -eq 0) {
    Write-Host "  set $SecretName"
  } else {
    Write-Warning "Failed to set $SecretName (check RBAC / provider registration)"
  }
}
Set-KvSecret 'sql-admin-password' $sqlPassword
Set-KvSecret 'database-url' $databaseUrl
if ($sbCs) { Set-KvSecret 'servicebus-connection-string' $sbCs }

if (-not (Test-Path $envExample)) {
  Write-Host 'Note: .env.example missing — create from template in repo.'
}

Write-Step 'Deployment summary (no secrets)'
[pscustomobject]@{
  SubscriptionId          = $SubscriptionId
  ResourceGroup           = $ResourceGroup
  Location                = $Location
  SqlServer               = $sqlServerName
  SqlFqdn                 = $sqlFqdn
  SqlDatabase             = $dbName
  AppService              = $webAppName
  AppServiceUrl           = "https://$apiHost"
  StaticWebApp            = $swaName
  StaticWebAppUrl         = "https://$swaHost"
  ServiceBusNamespace     = $sbNs
  KeyVault                = $kvNameOut
  LocalEnvFile            = $envFile
} | Format-List

Write-Host @'

Next steps:
  1. Entra app registration (SPA + API) — store secrets in Key Vault
  2. Tighten SQL firewall rule AllowAllDevPoC to your IP
  3. Connect SWA to GitHub for CI deploy (or az staticwebapp deploy)
  4. GitHub Actions OIDC → Key Vault; App Service KV references
  5. pnpm install && pull DATABASE_URL from Key Vault for Prisma migrate

'@ -ForegroundColor Green
