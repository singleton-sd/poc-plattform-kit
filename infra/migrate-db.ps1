<#
.SYNOPSIS
  Apply forward-only Prisma migrations to Neon PostgreSQL using Key Vault URLs.

.DESCRIPTION
  Pulls `database-url` (pooled) and `database-url-unpooled` (direct / Prisma
  `directUrl`) from Key Vault into a gitignored `packages/db/.env`, then runs
  `prisma migrate deploy` (never `migrate dev` against shared Neon).

  Never prints secret values. Never put DATABASE_URL in GitHub Secrets — use
  OIDC → Key Vault locally or in a future CI job.

.EXAMPLE
  pwsh ./infra/migrate-db.ps1
  pwsh ./infra/migrate-db.ps1 -WhatIf
  pwsh ./infra/migrate-db.ps1 -StatusOnly
#>

[CmdletBinding()]
param(
  [string]$SubscriptionId = '7b8343d7-969f-4b71-8864-b7925e7fae30',
  [string]$KeyVaultName = 'ssd-pocpk-kv-dev-ae',
  [string]$SecretName = 'database-url',
  [string]$UnpooledSecretName = 'database-url-unpooled',
  [switch]$WhatIf,
  [switch]$StatusOnly
)

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$dbDir = Join-Path $repoRoot 'packages/db'
$envFile = Join-Path $dbDir '.env'

function Write-Step([string]$Message) {
  Write-Host "`n==> $Message" -ForegroundColor Cyan
}

if (-not (Test-Path $dbDir)) {
  throw "packages/db not found at $dbDir"
}

Write-Step "Setting subscription $SubscriptionId"
az account set --subscription $SubscriptionId
if ($LASTEXITCODE -ne 0) { throw "az account set failed: $LASTEXITCODE" }

Write-Step "Reading Key Vault secret $SecretName from $KeyVaultName (value not logged)"
$databaseUrl = az keyvault secret show --vault-name $KeyVaultName --name $SecretName --query value -o tsv
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($databaseUrl)) {
  throw "Failed to read $SecretName from Key Vault"
}

Write-Step "Reading Key Vault secret $UnpooledSecretName (Prisma directUrl; value not logged)"
$databaseUrlUnpooled = az keyvault secret show --vault-name $KeyVaultName --name $UnpooledSecretName --query value -o tsv 2>$null
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($databaseUrlUnpooled)) {
  throw "Failed to read $UnpooledSecretName from Key Vault (required for Prisma directUrl / migrate; do not use the pooled URL)"
}

if ($WhatIf) {
  Write-Host "WhatIf: would write gitignored packages/db/.env (DATABASE_URL length=$($databaseUrl.Length); UNPOOLED length=$($databaseUrlUnpooled.Length))"
  Write-Host 'WhatIf: would run: pnpm exec prisma migrate deploy (cwd packages/db)'
  $databaseUrl = $null
  $databaseUrlUnpooled = $null
  exit 0
}

Write-Step 'Writing gitignored packages/db/.env (values not logged)'
@(
  "DATABASE_URL=$databaseUrl"
  "DATABASE_URL_UNPOOLED=$databaseUrlUnpooled"
) | Set-Content -Path $envFile -Encoding utf8
$databaseUrl = $null
$databaseUrlUnpooled = $null
$env:DATABASE_URL = $null
$env:DATABASE_URL_UNPOOLED = $null

Push-Location $dbDir
try {
  if ($StatusOnly) {
    Write-Step 'prisma migrate status'
    pnpm exec prisma migrate status
    if ($LASTEXITCODE -ne 0) { throw "prisma migrate status failed: $LASTEXITCODE" }
  } else {
    Write-Step 'prisma migrate deploy (forward-only, Neon PostgreSQL)'
    pnpm exec prisma migrate deploy
    if ($LASTEXITCODE -ne 0) { throw "prisma migrate deploy failed: $LASTEXITCODE" }
    Write-Step 'prisma migrate status'
    pnpm exec prisma migrate status
  }
} finally {
  Pop-Location
}

Write-Step 'Done'
Write-Host 'Verify: POST https://api.plattform-kit.poc.singletonsd.com/tenants (or App Service host).'
