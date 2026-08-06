<#
.SYNOPSIS
  Rebuild Key Vault `database-url` from `sql-admin-password` and sync Azure SQL.

.DESCRIPTION
  When App Service has DATABASE_URL as a Key Vault reference but Prisma fails
  with "Authentication failed … pocpkadmin", the SQL admin password and the
  `database-url` secret are usually out of sync.

  This script:
  1. Reads `sql-admin-password` from Key Vault (never prints the value).
  2. Resets the Azure SQL server admin password to that value.
  3. Rebuilds `database-url` (Prisma sqlserver URL) and upserts it to Key Vault.
  4. Restarts the API App Service so unversioned Key Vault refs reload.

  Never commit secret values. Never paste them into ClickUp / PRs / chat.

.EXAMPLE
  pwsh ./infra/refresh-database-url.ps1
  pwsh ./infra/refresh-database-url.ps1 -WhatIf
#>

[CmdletBinding()]
param(
  [string]$SubscriptionId = '7b8343d7-969f-4b71-8864-b7925e7fae30',
  [string]$ResourceGroup = 'rg-poc-plattform-kit',
  [string]$KeyVaultName = 'ssd-pocpk-kv-dev-ae',
  [string]$SqlServerName = 'pocpk-sql-si5fhs6dvxiha',
  [string]$SqlFqdn = 'pocpk-sql-si5fhs6dvxiha.database.windows.net',
  [string]$SqlDatabaseName = 'pocpk',
  [string]$SqlAdminLogin = 'pocpkadmin',
  [string]$WebAppName = 'pocpk-api-si5fhs6dvxiha',
  [switch]$WhatIf,
  [switch]$SkipSqlReset,
  [switch]$SkipWebAppRestart
)

$ErrorActionPreference = 'Stop'

function Write-Step([string]$Message) {
  Write-Host "`n==> $Message" -ForegroundColor Cyan
}

Write-Step "Setting subscription $SubscriptionId"
az account set --subscription $SubscriptionId
if ($LASTEXITCODE -ne 0) { throw "az account set failed: $LASTEXITCODE" }

Write-Step "Reading Key Vault secret sql-admin-password from $KeyVaultName (value not logged)"
$password = az keyvault secret show --vault-name $KeyVaultName --name sql-admin-password --query value -o tsv
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($password)) {
  throw 'Failed to read sql-admin-password from Key Vault'
}

$encPassword = [uri]::EscapeDataString($password)
$databaseUrl = "sqlserver://${SqlFqdn}:1433;database=${SqlDatabaseName};user=${SqlAdminLogin};password=${encPassword};encrypt=true;trustServerCertificate=false"

if ($WhatIf) {
  Write-Host 'WhatIf: would reset SQL admin password to match KV sql-admin-password'
  Write-Host 'WhatIf: would upsert KV secret database-url (Prisma connection string)'
  if (-not $SkipWebAppRestart) {
    Write-Host "WhatIf: would restart App Service $WebAppName"
  }
  $password = $null
  $encPassword = $null
  $databaseUrl = $null
  exit 0
}

if (-not $SkipSqlReset) {
  Write-Step "Resetting SQL admin password on $SqlServerName to match KV (value not logged)"
  az sql server update --resource-group $ResourceGroup --name $SqlServerName --admin-password $password -o none
  if ($LASTEXITCODE -ne 0) { throw "az sql server update failed: $LASTEXITCODE" }
}

Write-Step 'Upserting Key Vault secret database-url (value not logged)'
az keyvault secret set --vault-name $KeyVaultName --name database-url --value $databaseUrl -o none
if ($LASTEXITCODE -ne 0) { throw "az keyvault secret set failed: $LASTEXITCODE" }

$password = $null
$encPassword = $null
$databaseUrl = $null

if (-not $SkipWebAppRestart) {
  Write-Step "Restarting App Service $WebAppName (reload Key Vault refs)"
  az webapp restart --resource-group $ResourceGroup --name $WebAppName -o none
  if ($LASTEXITCODE -ne 0) { throw "az webapp restart failed: $LASTEXITCODE" }
}

Write-Step 'Done (no secret values printed)'
Write-Host @"
Next:
  1. Confirm App Service DATABASE_URL Key Vault ref status is Resolved.
  2. POST /tenants — auth failures should be gone.
  3. If Prisma reports missing tables (e.g. dbo.tenants), apply migrations separately.
"@
