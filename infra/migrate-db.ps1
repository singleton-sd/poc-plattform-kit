<#
.SYNOPSIS
  Apply forward-only Prisma migrations to Azure SQL using Key Vault DATABASE_URL.

.DESCRIPTION
  Pulls `database-url` from Key Vault into a gitignored `packages/db/.env`, then
  runs `prisma migrate deploy` (never `migrate dev` against shared Azure SQL).

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

if ($WhatIf) {
  Write-Host "WhatIf: would write gitignored packages/db/.env (DATABASE_URL length=$($databaseUrl.Length))"
  Write-Host 'WhatIf: would run: pnpm exec prisma migrate deploy (cwd packages/db)'
  $databaseUrl = $null
  exit 0
}

Write-Step 'Writing gitignored packages/db/.env (value not logged)'
Set-Content -Path $envFile -Value "DATABASE_URL=$databaseUrl" -Encoding utf8
$databaseUrl = $null
$env:DATABASE_URL = $null

Push-Location $dbDir
try {
  if ($StatusOnly) {
    Write-Step 'prisma migrate status'
    pnpm exec prisma migrate status
    if ($LASTEXITCODE -ne 0) { throw "prisma migrate status failed: $LASTEXITCODE" }
  } else {
    Write-Step 'prisma migrate deploy (forward-only)'
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
