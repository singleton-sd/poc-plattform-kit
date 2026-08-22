<#
.SYNOPSIS
  Deploy marketing-edge Azure Function (infra + zip) for Contact + health.

.DESCRIPTION
  Deploys infra/decap-oauth.bicep then zips apps/marketing-oauth for
  az functionapp deployment source config-zip.

  This Function is no longer a Decap GitHub OAuth proxy. Decap /admin login
  uses shared cms-oauth-kit (https://auth.singletonsd.com). Do not pass
  OAuth client ids or require KV github-decap-oauth-client-secret.

  Order is required for Contact: Bicep applies FORWARD_EMAIL_TOKEN / EMAIL_* /
  CONTACT_* app settings (KV refs) before zip; zip-only (-SkipInfra) leaves
  /contact returning 503 until infra is reapplied. Zip deploy vendors the built
  @poc-plattform-kit/email package (workspace:* is not available on Azure).

  Prerequisites:
  - az login (or OIDC in CI)
  - Forward Email API key in KV as forwardemail-api-key

.EXAMPLE
  pwsh ./scripts/deploy-decap-oauth.ps1
#>
[CmdletBinding()]
param(
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
      --name "decap-oauth-$(Get-Date -Format 'yyyyMMddHHmmss')" | Out-Host
  }

  if ($SkipZip) {
    return
  }

  Write-Host "Building @poc-plattform-kit/email + marketing-oauth ..."
  pnpm --filter @poc-plattform-kit/email... install
  pnpm --filter @poc-plattform-kit/email run build
  pnpm --filter @poc-plattform-kit/marketing-oauth run build

  $stage = Join-Path $env:TEMP "decap-oauth-stage-$(Get-Random)"
  New-Item -ItemType Directory -Path $stage | Out-Null
  try {
    Copy-Item (Join-Path $appDir 'host.json') $stage
    $stagePackage = Get-Content (Join-Path $appDir 'package.json') -Raw | ConvertFrom-Json
    # Zip stage cannot resolve pnpm workspace:* — vendor the built email package.
    if ($stagePackage.dependencies.'@poc-plattform-kit/email') {
      $stagePackage.dependencies.PSObject.Properties.Remove('@poc-plattform-kit/email')
    }
    ($stagePackage | ConvertTo-Json -Depth 10) | Set-Content (Join-Path $stage 'package.json') -Encoding utf8
    Copy-Item (Join-Path $appDir 'dist') (Join-Path $stage 'dist') -Recurse

    # npm install first — vendoring before install gets pruned as extraneous.
    Push-Location $stage
    try {
      npm install --omit=dev --package-lock=false | Out-Host
    }
    finally {
      Pop-Location
    }

    $emailSrc = Join-Path $root 'packages/email'
    $emailDest = Join-Path $stage 'node_modules/@poc-plattform-kit/email'
    $emailEntry = Join-Path $emailDest 'dist/index.js'
    New-Item -ItemType Directory -Path $emailDest -Force | Out-Null
    Copy-Item (Join-Path $emailSrc 'package.json') $emailDest
    Copy-Item (Join-Path $emailSrc 'dist') (Join-Path $emailDest 'dist') -Recurse
    if (-not (Test-Path $emailEntry)) {
      throw "Vendored email package missing $emailEntry"
    }

    $zipPath = Join-Path $env:TEMP 'decap-oauth-deploy.zip'
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
    # The .NET ZIP API creates a Linux/Kudu-friendly archive on every platform.
    [System.IO.Compression.ZipFile]::CreateFromDirectory($stage, $zipPath)

    Write-Host "Zip deploying to $FunctionAppName ..."
    az functionapp deployment source config-zip `
      --resource-group $ResourceGroup `
      --name $FunctionAppName `
      --src $zipPath | Out-Host

    Write-Host "Done. Contact: https://$FunctionAppName.azurewebsites.net/contact"
    Write-Host "Health: https://$FunctionAppName.azurewebsites.net/health"
  }
  finally {
    Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
  }
}
finally {
  Pop-Location
}
