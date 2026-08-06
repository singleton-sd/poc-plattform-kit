<#
.SYNOPSIS
  Provision poc-plattform-kit Azure resources (idempotent Bicep deploy).

.DESCRIPTION
  Creates RG (if missing), generates a SQL admin password once (saved to local .env),
  and deploys infra/main.bicep into the target subscription.

  Secrets are written to Azure Key Vault (locked store). Non-secret config and
  Key Vault references go to Azure App Configuration. Local .env is an optional
  gitignored cache. Never commit .env or secret values. Never put secrets in
  GitHub Actions secrets — pipelines use OIDC → Azure → KV/App Config.

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
  [string]$AppConfigName = 'ssd-pocpk-appcs-dev-ae',
  [string]$DeploymentName = 'pocpk-infra',
  [string]$AlertEmail = '',
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
  "appConfigName=$AppConfigName",
  "appConfigSku=Free",
  "deployerObjectId=$deployerObjectId",
  "appServiceSku=B1",
  "sqlAdminLogin=$sqlLogin",
  "sqlAdminPassword=$sqlPassword",
  "alertEmail=$AlertEmail",
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
$marketingSwaHost = Get-Out 'marketingStaticWebAppHostname'
$sbNs = Get-Out 'serviceBusNamespaceName'
$sqlServerName = Get-Out 'sqlServerName'
$webAppName = Get-Out 'webAppName'
$swaName = Get-Out 'staticWebAppName'
$marketingSwaName = Get-Out 'marketingStaticWebAppName'

# Locked public hostnames (DNS in AWS Route53 → Azure CNAMEs)
$publicApiUrl = 'https://api.plattform-kit.poc.singletonsd.com'
$publicAppUrl = 'https://app.plattform-kit.poc.singletonsd.com'
$publicMarketingUrl = 'https://plattform-kit.poc.singletonsd.com'
$corsOrigins = "$publicAppUrl,$publicMarketingUrl"

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
  "AZURE_APP_SERVICE_URL=$publicApiUrl",
  "AZURE_STATIC_WEB_APP_NAME=$swaName",
  "AZURE_STATIC_WEB_APP_URL=$publicAppUrl",
  "AZURE_MARKETING_SWA_NAME=$marketingSwaName",
  "AZURE_MARKETING_URL=$publicMarketingUrl",
  "AZURE_SERVICEBUS_NAMESPACE=$sbNs",
  'AZURE_SERVICEBUS_CONNECTION_STRING=',
  "NEXT_PUBLIC_API_BASE_URL=$publicApiUrl",
  "CORS_ORIGINS=$corsOrigins",
  'AUTH_SECRET=',
  'AZURE_AD_CLIENT_ID=',
  'AZURE_AD_CLIENT_SECRET=',
  'AZURE_AD_TENANT_ID=',
  'AZURE_AD_API_AUDIENCE='
)

# Preserve existing AUTH / Entra values if present
if (Test-Path $envFile) {
  $existing = Get-Content $envFile -Raw
  foreach ($key in @('AUTH_SECRET', 'AZURE_AD_CLIENT_ID', 'AZURE_AD_CLIENT_SECRET', 'AZURE_AD_TENANT_ID', 'AZURE_AD_API_AUDIENCE', 'AZURE_SERVICEBUS_CONNECTION_STRING')) {
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

$appInsightsNameOut = Get-Out 'applicationInsightsName'
if (-not $appInsightsNameOut) { $appInsightsNameOut = 'ssd-pocpk-appi-dev-ae' }
Write-Step "Upserting App Insights connection string into Key Vault (name only logged)"
$appInsightsCs = az monitor app-insights component show `
  --app $appInsightsNameOut `
  --resource-group $ResourceGroup `
  --query connectionString -o tsv 2>$null
if ($appInsightsCs) {
  Set-KvSecret 'appinsights-connection-string' $appInsightsCs
  if (Test-Path $envFile) {
    $envRawAi = Get-Content $envFile -Raw
    if ($envRawAi -notmatch '(?m)^\s*APPLICATIONINSIGHTS_CONNECTION_STRING=') {
      Add-Content -Path $envFile -Value "APPLICATIONINSIGHTS_CONNECTION_STRING=$appInsightsCs" -Encoding utf8
    } else {
      (Get-Content $envFile) | ForEach-Object {
        if ($_ -match '^APPLICATIONINSIGHTS_CONNECTION_STRING=') { "APPLICATIONINSIGHTS_CONNECTION_STRING=$appInsightsCs" } else { $_ }
      } | Set-Content $envFile -Encoding utf8
    }
  }
  Remove-Variable appInsightsCs -ErrorAction SilentlyContinue
} else {
  Write-Host '  skipped appinsights-connection-string (component not found yet)'
}

# SWA deployment tokens → KV only (never GitHub Secrets)
Write-Step 'Upserting SWA deployment tokens into Key Vault (if available)'
$swaToken = az staticwebapp secrets list --name $swaName --resource-group $ResourceGroup --query 'properties.apiKey' -o tsv 2>$null
if ($swaToken) {
  Set-KvSecret 'swa-deployment-token' $swaToken
  Remove-Variable swaToken -ErrorAction SilentlyContinue
} else {
  Write-Host '  skipped swa-deployment-token (CLI could not read SWA apiKey)'
}
$mktToken = az staticwebapp secrets list --name $marketingSwaName --resource-group $ResourceGroup --query 'properties.apiKey' -o tsv 2>$null
if ($mktToken) {
  Set-KvSecret 'swa-marketing-deployment-token' $mktToken
  Remove-Variable mktToken -ErrorAction SilentlyContinue
} else {
  Write-Host '  skipped swa-marketing-deployment-token (CLI could not read marketing SWA apiKey)'
}

$appConfigOut = Get-Out 'appConfigName'
if (-not $appConfigOut) { $appConfigOut = $AppConfigName }
$appConfigEndpoint = Get-Out 'appConfigEndpoint'

Write-Step "Seeding App Configuration $appConfigOut (plain keys + KV refs)"
function Set-AppConfigPlain([string]$Key, [string]$Value) {
  if ([string]::IsNullOrWhiteSpace($Value)) { return }
  az appconfig kv set --name $appConfigOut --key $Key --value $Value --yes -o none
  if ($LASTEXITCODE -eq 0) { Write-Host "  set $Key" }
}
function Set-AppConfigKvRef([string]$Key, [string]$SecretName) {
  $secretId = "https://$kvNameOut.vault.azure.net/secrets/$SecretName"
  az appconfig kv set-keyvault --name $appConfigOut --key $Key --secret-identifier $secretId --yes -o none
  if ($LASTEXITCODE -eq 0) { Write-Host "  kv-ref $Key -> $SecretName" }
}
Set-AppConfigPlain 'app:api:baseUrl' $publicApiUrl
Set-AppConfigPlain 'app:web:baseUrl' $publicAppUrl
Set-AppConfigPlain 'app:marketing:baseUrl' $publicMarketingUrl
Set-AppConfigPlain 'app:cors:origins' $corsOrigins
Set-AppConfigPlain 'app:web:swaName' $swaName
Set-AppConfigPlain 'app:marketing:swaName' $marketingSwaName
Set-AppConfigPlain 'app:azure:resourceGroup' $ResourceGroup
Set-AppConfigPlain 'app:azure:keyVaultName' $kvNameOut
Set-AppConfigKvRef 'secret:database-url' 'database-url'
Set-AppConfigKvRef 'secret:servicebus-connection-string' 'servicebus-connection-string'
Set-AppConfigKvRef 'secret:sql-admin-password' 'sql-admin-password'
Set-AppConfigKvRef 'secret:swa-deployment-token' 'swa-deployment-token'
Set-AppConfigKvRef 'secret:appinsights-connection-string' 'appinsights-connection-string'
Set-AppConfigPlain 'app:telemetry:cloudRoleName:api' 'api'
Set-AppConfigPlain 'app:telemetry:cloudRoleName:web' 'web'
Set-AppConfigKvRef 'secret:swa-marketing-deployment-token' 'swa-marketing-deployment-token'

# Entra non-secrets from local .env when present (IDs only — secrets stay in KV)
function Get-EnvValue([string]$Key) {
  if (-not (Test-Path $envFile)) { return $null }
  $raw = Get-Content $envFile -Raw
  if ($raw -match "(?m)^\s*$([regex]::Escape($Key))=(.*)$") {
    $v = $Matches[1].Trim()
    if ($v) { return $v }
  }
  return $null
}
function Test-KvSecretExists([string]$SecretName) {
  az keyvault secret show --vault-name $kvNameOut --name $SecretName -o none 2>$null
  return ($LASTEXITCODE -eq 0)
}
function Set-AppConfigKvRefIfSecretExists([string]$Key, [string]$SecretName) {
  if (Test-KvSecretExists $SecretName) {
    Set-AppConfigKvRef $Key $SecretName
  } else {
    Write-Host "  skip $Key (Key Vault secret '$SecretName' not present yet)"
  }
}

Set-AppConfigPlain 'app:azureAd:clientId' (Get-EnvValue 'AZURE_AD_CLIENT_ID')
Set-AppConfigPlain 'app:azureAd:tenantId' (Get-EnvValue 'AZURE_AD_TENANT_ID')
Set-AppConfigPlain 'app:azureAd:apiAudience' (Get-EnvValue 'AZURE_AD_API_AUDIENCE')

# Upsert AUTH_SECRET / AZURE_AD_CLIENT_SECRET into KV when present in .env (never inline in App Config)
$authSecret = Get-EnvValue 'AUTH_SECRET'
if ($authSecret) { Set-KvSecret 'auth-secret' $authSecret }
$adClientSecret = Get-EnvValue 'AZURE_AD_CLIENT_SECRET'
if ($adClientSecret) { Set-KvSecret 'azure-ad-client-secret' $adClientSecret }

# Only publish KV refs after the secrets exist — otherwise Nest bootstrap fails resolving them
Set-AppConfigKvRefIfSecretExists 'secret:auth-secret' 'auth-secret'
Set-AppConfigKvRefIfSecretExists 'secret:azure-ad-client-secret' 'azure-ad-client-secret'

if (Test-Path $envFile) {
  $envRaw = Get-Content $envFile -Raw
  if ($envRaw -notmatch '(?m)^\s*AZURE_APPCONFIGURATION_ENDPOINT=') {
    Add-Content -Path $envFile -Value "AZURE_APPCONFIGURATION_ENDPOINT=$appConfigEndpoint" -Encoding utf8
  } else {
    (Get-Content $envFile) | ForEach-Object {
      if ($_ -match '^AZURE_APPCONFIGURATION_ENDPOINT=') { "AZURE_APPCONFIGURATION_ENDPOINT=$appConfigEndpoint" } else { $_ }
    } | Set-Content $envFile -Encoding utf8
  }
}

if (-not (Test-Path $envExample)) {
  Write-Host 'Note: .env.example missing — create from template in repo.'
}

Write-Step 'Deployment summary (no secrets)'
[pscustomobject]@{
  SubscriptionId           = $SubscriptionId
  ResourceGroup            = $ResourceGroup
  Location                 = $Location
  SqlServer                = $sqlServerName
  SqlFqdn                  = $sqlFqdn
  SqlDatabase              = $dbName
  AppService               = $webAppName
  AppServiceUrl            = $publicApiUrl
  AppServiceDefaultHost    = "https://$apiHost"
  StaticWebApp             = $swaName
  StaticWebAppUrl          = $publicAppUrl
  StaticWebAppDefaultHost  = "https://$swaHost"
  MarketingSwa             = $marketingSwaName
  MarketingUrl             = $publicMarketingUrl
  MarketingDefaultHost     = "https://$marketingSwaHost"
  ServiceBusNamespace      = $sbNs
  KeyVault                 = $kvNameOut
  AppConfiguration         = $appConfigOut
  AppConfigurationEndpoint = $appConfigEndpoint
  ApplicationInsights      = $appInsightsNameOut
  LocalEnvFile             = $envFile
} | Format-List

Write-Host @'

Next steps:
  1. AWS Route53: CNAME marketing/app/api hostnames → Azure defaults (+ TXT validation)
  2. Bind custom domains + managed certs on SWAs and App Service (B1)
  3. Entra app registration (SPA + API) — secrets in Key Vault; config in App Config
  4. Tighten SQL firewall rule AllowAllDevPoC to your IP
  5. Confirm GitHub Variables AZURE_CLIENT_ID / AZURE_TENANT_ID / AZURE_SUBSCRIPTION_ID (OIDC)
  6. Wire App Service / SWA / ACA to App Configuration provider + managed identity
  7. pnpm install && pull DATABASE_URL from Key Vault for Prisma migrate
  8. Never store deploy tokens or connection strings in GitHub Secrets

'@ -ForegroundColor Green
