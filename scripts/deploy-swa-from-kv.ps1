<#
.SYNOPSIS
  Deploy a static folder to Azure Static Web Apps using a Key Vault deploy token.

.DESCRIPTION
  Generic SWA deploy helper. Prefer -ConfigPath + -DeployName to pick an entry
  from deploys[] in a custom-domains JSON, or pass Vault/Secret/AppLocation
  explicitly for one-off deploys.

.EXAMPLE
  # Marketing from default Platform Kit config
  powershell -File ./scripts/deploy-swa-from-kv.ps1 -DeployName marketing

.EXAMPLE
  # Explicit one-off
  powershell -File ./scripts/deploy-swa-from-kv.ps1 `
    -VaultName ssd-pocpk-kv-dev-ae `
    -SecretName swa-marketing-deployment-token `
    -AppLocation apps/marketing/public
#>
[CmdletBinding()]
param(
  [string]$ConfigPath = '',
  [string]$DeployName = '',
  [string]$VaultName = '',
  [string]$SecretName = '',
  [string]$AppLocation = '',
  [string]$Environment = 'production'
)

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')

if ($DeployName -or (-not $VaultName -and -not $SecretName -and -not $AppLocation)) {
  if (-not $ConfigPath) {
    $ConfigPath = Join-Path $repoRoot 'infra/custom-domains.pocpk.json'
  }
  if (-not (Test-Path $ConfigPath)) {
    throw "Config not found: $ConfigPath"
  }
  $config = Get-Content -Path $ConfigPath -Raw -Encoding utf8 | ConvertFrom-Json
  if (-not $config.deploys -or $config.deploys.Count -eq 0) {
    throw 'Config.deploys is empty; pass -VaultName/-SecretName/-AppLocation instead'
  }
  $entry = $null
  if ($DeployName) {
    $entry = $config.deploys | Where-Object { $_.name -eq $DeployName } | Select-Object -First 1
    if (-not $entry) { throw "No deploys[] entry named '$DeployName' in $ConfigPath" }
  }
  else {
    $entry = $config.deploys[0]
    Write-Host "Using first deploys[] entry: $($entry.name)"
  }
  if (-not $VaultName) { $VaultName = [string]$entry.vaultName }
  if (-not $SecretName) { $SecretName = [string]$entry.secretName }
  if (-not $AppLocation) { $AppLocation = [string]$entry.appLocation }
  if ($entry.environment) { $Environment = [string]$entry.environment }
}

if ([string]::IsNullOrWhiteSpace($VaultName) -or [string]::IsNullOrWhiteSpace($SecretName)) {
  throw 'VaultName and SecretName are required'
}
if (-not $AppLocation) {
  throw 'AppLocation is required (folder to upload)'
}
if (-not [System.IO.Path]::IsPathRooted($AppLocation)) {
  $AppLocation = Join-Path $repoRoot $AppLocation
}
if (-not (Test-Path $AppLocation)) {
  throw "AppLocation not found: $AppLocation"
}

$token = az keyvault secret show --vault-name $VaultName --name $SecretName --query value -o tsv
if (-not $token) { throw "Could not read $SecretName from $VaultName" }

Push-Location $repoRoot
try {
  npx --yes @azure/static-web-apps-cli@latest deploy $AppLocation `
    --deployment-token $token `
    --env $Environment `
    --no-use-keychain
  if ($LASTEXITCODE -ne 0) { throw "SWA deploy failed with exit $LASTEXITCODE" }
}
finally {
  Pop-Location
  Remove-Variable token -ErrorAction SilentlyContinue
}

Write-Host "SWA deploy finished ($AppLocation -> env=$Environment)."
