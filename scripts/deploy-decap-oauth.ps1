<#
.SYNOPSIS
  Deploy Decap GitHub OAuth Azure Function (infra + zip).

.DESCRIPTION
  Deploys infra/decap-oauth.bicep then zips apps/marketing-oauth for
  az functionapp deployment source config-zip.

  Order is required for Contact: Bicep applies FORWARDEMAIL_* / CONTACT_*
  app settings (KV refs) before zip; zip-only (-SkipInfra) leaves /contact
  returning 503 until infra is reapplied.

  Prerequisites:
  - az login (or OIDC in CI)
  - GitHub OAuth App created; client secret in KV as github-decap-oauth-client-secret
  - Pass -OauthClientId (GitHub OAuth App client id)

.EXAMPLE
  pwsh ./scripts/deploy-decap-oauth.ps1 -OauthClientId 'Ov23li...'
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string] $OauthClientId,

  [string] $ResourceGroup = 'rg-poc-plattform-kit',
  [string] $FunctionAppName = 'ssd-pocpk-decap-oauth-dev-ae',
  [string] $Location = 'australiaeast',
  [switch] $SkipInfra,
  [switch] $SkipZip
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$appDir = Join-Path $root 'apps/marketing-oauth'

Push-Location $root
try {
  if (-not $SkipInfra) {
    Write-Host "Deploying Bicep infra/decap-oauth.bicep ..."
    az deployment group create `
      --resource-group $ResourceGroup `
      --template-file (Join-Path $root 'infra/decap-oauth.bicep') `
      --parameters oauthClientId=$OauthClientId `
      --name "decap-oauth-$(Get-Date -Format 'yyyyMMddHHmmss')" | Out-Host
  }

  if ($SkipZip) {
    return
  }

  Write-Host "Building @poc-plattform-kit/marketing-oauth ..."
  pnpm --filter @poc-plattform-kit/marketing-oauth... install
  pnpm --filter @poc-plattform-kit/marketing-oauth run build

  $stage = Join-Path $env:TEMP "decap-oauth-stage-$(Get-Random)"
  New-Item -ItemType Directory -Path $stage | Out-Null
  try {
    Copy-Item (Join-Path $appDir 'host.json') $stage
    Copy-Item (Join-Path $appDir 'package.json') $stage
    Copy-Item (Join-Path $appDir 'dist') (Join-Path $stage 'dist') -Recurse

    Push-Location $stage
    try {
      npm install --omit=dev --package-lock=false | Out-Host
      $zipPath = Join-Path $env:TEMP 'decap-oauth-deploy.zip'
      if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
      # The .NET ZIP API creates a Linux/Kudu-friendly archive on every platform.
      [System.IO.Compression.ZipFile]::CreateFromDirectory($stage, $zipPath)
    }
    finally {
      Pop-Location
    }

    Write-Host "Zip deploying to $FunctionAppName ..."
    az functionapp deployment source config-zip `
      --resource-group $ResourceGroup `
      --name $FunctionAppName `
      --src $zipPath | Out-Host

    Write-Host "Done. base_url=https://$FunctionAppName.azurewebsites.net"
    Write-Host "Health: https://$FunctionAppName.azurewebsites.net/health"
  }
  finally {
    Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
  }
}
finally {
  Pop-Location
}
