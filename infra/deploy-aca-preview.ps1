<#
.SYNOPSIS
  Provision Container Apps Environment + ACR Basic for API PR previews.

.DESCRIPTION
  Deploys infra/container-apps-preview.bicep into rg-poc-plattform-kit and upserts
  ACR admin credentials into Key Vault (ssd-pocpk-kv-dev-ae). Never commits secrets.

.EXAMPLE
  powershell -File ./infra/deploy-aca-preview.ps1
  powershell -File ./infra/deploy-aca-preview.ps1 -WhatIf
  powershell -File ./infra/deploy-aca-preview.ps1 -DeployBaseContainerApp
#>

[CmdletBinding()]
param(
  [string]$SubscriptionId = '7b8343d7-969f-4b71-8864-b7925e7fae30',
  [string]$ResourceGroup = 'rg-poc-plattform-kit',
  [string]$Location = 'australiaeast',
  [string]$KeyVaultName = 'ssd-pocpk-kv-dev-ae',
  [string]$AcrName = 'ssdpocpkacrdevae',
  [string]$ContainerAppsEnvironmentName = 'ssd-pocpk-cae-dev-ae',
  [string]$DeploymentName = 'pocpk-aca-preview',
  [switch]$DeployBaseContainerApp,
  [switch]$WhatIf
)

$ErrorActionPreference = 'Stop'
$bicepFile = Join-Path $PSScriptRoot 'container-apps-preview.bicep'

function Write-Step([string]$Message) {
  Write-Host "`n==> $Message" -ForegroundColor Cyan
}

Write-Step 'Checking Azure CLI login'
$accountJson = az account show -o json 2>$null
if (-not $accountJson) {
  Write-Host @'
Not logged in to Azure CLI.

Run:
  az login
  az account set --subscription 7b8343d7-969f-4b71-8864-b7925e7fae30
  powershell -File ./infra/deploy-aca-preview.ps1
'@ -ForegroundColor Yellow
  exit 1
}

Write-Step "Setting subscription $SubscriptionId"
az account set --subscription $SubscriptionId
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Step 'Ensuring Microsoft.App / ContainerRegistry providers are registered'
foreach ($ns in @('Microsoft.App', 'Microsoft.ContainerRegistry', 'Microsoft.OperationalInsights')) {
  $state = az provider show -n $ns --query registrationState -o tsv 2>$null
  if ($state -ne 'Registered') {
    Write-Host "Registering $ns (current: $state)..."
    az provider register -n $ns --wait | Out-Null
  } else {
    Write-Host "$ns already Registered"
  }
}

$rgExists = az group exists --name $ResourceGroup -o tsv
if ($rgExists -eq 'false') {
  Write-Error "Resource group $ResourceGroup missing. Run ./infra/deploy.ps1 first."
  exit 1
}

Write-Step $(if ($WhatIf) { 'Running what-if' } else { 'Deploying Container Apps preview stack' })
$deployArgs = @(
  'deployment', 'group', $(if ($WhatIf) { 'what-if' } else { 'create' }),
  '--name', $DeploymentName,
  '--resource-group', $ResourceGroup,
  '--template-file', $bicepFile,
  '--parameters',
  "location=$Location",
  "acrName=$AcrName",
  "containerAppsEnvironmentName=$ContainerAppsEnvironmentName",
  "deployBaseContainerApp=$($DeployBaseContainerApp.IsPresent.ToString().ToLowerInvariant())",
  '--output', 'json'
)

$deployOut = & az @deployArgs
if ($LASTEXITCODE -ne 0) {
  Write-Error 'ACA preview deployment failed.'
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

$loginServer = Get-Out 'acrLoginServer'
$caeName = Get-Out 'containerAppsEnvironmentName'
$caeDomain = Get-Out 'containerAppsEnvironmentDefaultDomain'

Write-Step "Upserting ACR credentials into Key Vault $KeyVaultName (names only logged)"
$creds = az acr credential show --name $AcrName --resource-group $ResourceGroup -o json | ConvertFrom-Json
if (-not $creds) {
  Write-Error 'Failed to read ACR credentials.'
  exit 1
}

$acrUser = $creds.username
$acrPass = $creds.passwords[0].value

function Set-KvSecret([string]$SecretName, [string]$SecretValue) {
  if ([string]::IsNullOrWhiteSpace($SecretValue)) { return }
  az keyvault secret set --vault-name $KeyVaultName --name $SecretName --value $SecretValue -o none
  if ($LASTEXITCODE -eq 0) {
    Write-Host "  set $SecretName"
  } else {
    Write-Warning "Failed to set $SecretName (check RBAC)"
  }
}

Set-KvSecret 'acr-admin-username' $acrUser
Set-KvSecret 'acr-admin-password' $acrPass
Set-KvSecret 'acr-login-server' $loginServer

Write-Step 'Deployment summary (no secrets)'
[pscustomobject]@{
  SubscriptionId                 = $SubscriptionId
  ResourceGroup                  = $ResourceGroup
  AcrName                        = $AcrName
  AcrLoginServer                 = $loginServer
  ContainerAppsEnvironment       = $caeName
  DefaultDomain                  = $caeDomain
  EphemeralAppPattern            = 'ssd-pocpk-aca-pr-<n>-ae'
  KeyVault                       = $KeyVaultName
  KeyVaultSecrets                = 'acr-admin-username, acr-admin-password, acr-login-server'
} | Format-List

Write-Host @'

Next (human / GitHub):
  1. Create Entra app + federated credential for GitHub OIDC (preferred), or
     store AZURE_CREDENTIALS service-principal JSON as a repo secret.
  2. Grant the identity: Contributor (or narrower) on RG + AcrPush on ACR.
  3. Repo secrets/vars: AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_SUBSCRIPTION_ID
     (OIDC) — or AZURE_CREDENTIALS. Optional: pull ACR password from KV in CI.
  4. Open an API PR; preview-api.yml builds, pushes, and deploys ssd-pocpk-aca-pr-<n>-ae.

'@ -ForegroundColor Green
