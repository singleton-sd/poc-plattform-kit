<#
.SYNOPSIS
  Provision OpenFGA on ACA + Neon PostgreSQL, Entra OIDC app, store/model bootstrap.

.DESCRIPTION
  Idempotent bootstrap for ssd-pocpk-openfga-dev-ae:
    1. Deploy infra/openfga.bicep (ACA + Neon PostgreSQL datastore on existing CAE)
    2. Ensure Entra app registration api://{tenantId}/ssd-pocpk-openfga (assignment-required)
    3. Assign the Nest API App Service managed identity as the sole app-role assignee
    4. Create/reuse OpenFGA store, push infra/openfga/model.json
    5. Seed App Configuration app:openfga:* keys read by apps/api

  Safe to re-run. Never commits secrets. Prefer Azure CLI login / GitHub OIDC
  (same Variables as preview-api.yml) - no AZURE_CREDENTIALS / SP-JSON.

.EXAMPLE
  powershell -File ./infra/deploy-openfga.ps1 -WhatIf
  powershell -File ./infra/deploy-openfga.ps1
  powershell -File ./infra/deploy-openfga.ps1 -SkipEntra -SkipBootstrap
#>

[CmdletBinding()]
param(
  [string]$SubscriptionId = '7b8343d7-969f-4b71-8864-b7925e7fae30',
  [string]$ResourceGroup = 'rg-poc-plattform-kit',
  [string]$Location = 'australiaeast',
  [string]$ContainerAppsEnvironmentName = 'ssd-pocpk-cae-dev-ae',
  [string]$OpenFgaAppName = 'ssd-pocpk-openfga-dev-ae',
  [string]$KeyVaultName = 'ssd-pocpk-kv-dev-ae',
  [string]$NeonBranch = 'production',
  [string]$NeonOpenFgaDatabase = 'openfga',
  [string]$AppConfigName = 'ssd-pocpk-appcs-dev-ae',
  [string]$ApiWebAppName = 'pocpk-api-si5fhs6dvxiha',
  [string]$OpenFgaImageTag = 'v1.18.3',
  [string]$OpenFgaAudience = 'api://9a0e57d7-e58e-4e8b-814d-037cd7d9015c/ssd-pocpk-openfga',
  [string]$OpenFgaAppDisplayName = 'ssd-pocpk-openfga',
  [string]$StoreName = 'poc-plattform-kit',
  [string]$DeploymentName = 'pocpk-openfga',
  [string]$AppRoleValue = 'OpenFga.Access',
  [switch]$SkipEntra,
  [switch]$SkipBootstrap,
  [switch]$WhatIf
)

$ErrorActionPreference = 'Stop'
$bicepFile = Join-Path $PSScriptRoot 'openfga.bicep'
$modelJsonFile = Join-Path $PSScriptRoot 'openfga\model.json'
$modelFgaFile = Join-Path $PSScriptRoot 'openfga\model.fga'

function Write-Step([string]$Message) {
  Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Assert-LastExit([string]$Action) {
  if ($LASTEXITCODE -ne 0) {
    Write-Error "$Action failed (exit $LASTEXITCODE)."
    exit $LASTEXITCODE
  }
}

function Read-DotEnvValue {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [Parameter(Mandatory = $true)][string]$Key
  )
  if (-not (Test-Path $FilePath)) { return $null }
  foreach ($line in Get-Content -Path $FilePath -ErrorAction SilentlyContinue) {
    if ($line -match "^\s*$([regex]::Escape($Key))\s*=\s*(.*)\s*$") {
      $value = $Matches[1].Trim()
      if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
        $value = $value.Substring(1, $value.Length - 2)
      }
      return $value
    }
  }
  return $null
}

function Get-NeonOpenFgaDatastoreUris {
  $repoRoot = Split-Path $PSScriptRoot -Parent
  $envFile = Join-Path $repoRoot '.env'
  $runtime = Read-DotEnvValue -FilePath $envFile -Key 'OPENFGA_DATASTORE_URI'
  $migrate = Read-DotEnvValue -FilePath $envFile -Key 'OPENFGA_DATASTORE_URI_UNPOOLED'
  if ($runtime -and $migrate) {
    Write-Host 'Using OpenFGA datastore URIs from repo .env'
    return [pscustomobject]@{ Runtime = $runtime; Migrate = $migrate }
  }

  Write-Host "Resolving Neon OpenFGA URIs via neon CLI (branch=$NeonBranch, database=$NeonOpenFgaDatabase)"
  Push-Location $repoRoot
  try {
    $migrate = (& npx neon connection-string $NeonBranch --database-name $NeonOpenFgaDatabase 2>$null | Select-Object -Last 1).Trim()
    $runtime = (& npx neon connection-string $NeonBranch --database-name $NeonOpenFgaDatabase --pooled 2>$null | Select-Object -Last 1).Trim()
  } finally {
    Pop-Location
  }
  if ([string]::IsNullOrWhiteSpace($runtime) -or [string]::IsNullOrWhiteSpace($migrate)) {
    Write-Error @"
Could not resolve Neon OpenFGA connection strings.
Run ./scripts/neon-env-pull.sh (or set OPENFGA_DATASTORE_URI / OPENFGA_DATASTORE_URI_UNPOOLED in repo .env) and retry.
"@
    exit 1
  }
  return [pscustomobject]@{ Runtime = $runtime; Migrate = $migrate }
}

function Set-KeyVaultSecret {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Value
  )
  az keyvault secret set --vault-name $KeyVaultName --name $Name --value $Value -o none
  Assert-LastExit "az keyvault secret set $Name"
  Write-Host "  upserted Key Vault secret $Name"
}

function Protect-TempParametersFile {
  param([Parameter(Mandatory = $true)][string]$Path)
  if ($IsLinux -or $IsMacOS) {
    & chmod 600 $Path
    Assert-LastExit 'chmod 600 parameters file'
    return
  }
  if (-not $IsWindows) { return }
  $currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
  & icacls $Path /inheritance:r /grant:r "${currentUser}:(F)" | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to restrict ACL on temporary parameters file $Path"
    exit $LASTEXITCODE
  }
}

Write-Step 'Checking Azure CLI login'
$accountJson = az account show -o json 2>$null
if (-not $accountJson) {
  Write-Host @'
Not logged in to Azure CLI.

Run (interactive) or use GitHub OIDC Variables (same as preview-api.yml):
  az login
  az account set --subscription 7b8343d7-969f-4b71-8864-b7925e7fae30
  powershell -File ./infra/deploy-openfga.ps1
'@ -ForegroundColor Yellow
  exit 1
}

Write-Step "Setting subscription $SubscriptionId"
az account set --subscription $SubscriptionId
Assert-LastExit 'az account set'

# Resolve tenant after switching subscription (operator may start in another tenant).
$account = az account show -o json | ConvertFrom-Json
$entraTenantId = $account.tenantId
if ([string]::IsNullOrWhiteSpace($entraTenantId)) {
  Write-Error 'Could not resolve Entra tenant ID from az account show.'
  exit 1
}
Write-Host "Entra tenant: $entraTenantId"

Write-Step 'Ensuring Microsoft.App / Storage providers are registered'
foreach ($ns in @('Microsoft.App', 'Microsoft.Storage', 'Microsoft.OperationalInsights')) {
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

$caeExists = az containerapp env show -n $ContainerAppsEnvironmentName -g $ResourceGroup -o none 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Error "CAE $ContainerAppsEnvironmentName missing. Run ./infra/deploy-aca-preview.ps1 first."
  exit 1
}

if (-not (Test-Path $bicepFile)) {
  Write-Error "Missing $bicepFile"
  exit 1
}
if (-not (Test-Path $modelJsonFile)) {
  Write-Error "Missing $modelJsonFile (companion to $modelFgaFile)"
  exit 1
}

$datastoreUris = Get-NeonOpenFgaDatastoreUris
if (-not $WhatIf) {
  Write-Step "Upserting OpenFGA datastore secrets in Key Vault $KeyVaultName (values not logged)"
  Set-KeyVaultSecret -Name 'openfga-database-url' -Value $datastoreUris.Runtime
  Set-KeyVaultSecret -Name 'openfga-database-url-unpooled' -Value $datastoreUris.Migrate
}

Write-Step $(if ($WhatIf) { 'Running what-if' } else { 'Deploying OpenFGA Container App (Neon PostgreSQL)' })
$parametersFile = Join-Path ([System.IO.Path]::GetTempPath()) ("openfga-params-{0}.json" -f ([guid]::NewGuid().ToString('N')))
try {
  @{
    '$schema'                        = 'https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#'
    contentVersion                   = '1.0.0.0'
    parameters                       = @{
      location                         = @{ value = $Location }
      containerAppsEnvironmentName     = @{ value = $ContainerAppsEnvironmentName }
      openfgaAppName                   = @{ value = $OpenFgaAppName }
      openfgaImageTag                  = @{ value = $OpenFgaImageTag }
      oidcIssuer                       = @{ value = "https://login.microsoftonline.com/$entraTenantId/v2.0" }
      oidcIssuerAlias                  = @{ value = "https://sts.windows.net/$entraTenantId/" }
      openfgaAudience                  = @{ value = $OpenFgaAudience }
      openfgaDatastoreUriMigrate       = @{ value = $datastoreUris.Migrate }
      openfgaDatastoreUriRuntime       = @{ value = $datastoreUris.Runtime }
    }
  } | ConvertTo-Json -Depth 6 | Set-Content -Path $parametersFile -Encoding utf8
  Protect-TempParametersFile -Path $parametersFile

  $deployArgs = @(
    'deployment', 'group', $(if ($WhatIf) { 'what-if' } else { 'create' }),
    '--name', $DeploymentName,
    '--resource-group', $ResourceGroup,
    '--template-file', $bicepFile,
    '--parameters', "@$parametersFile",
    '--output', 'json'
  )

  $deployOut = & az @deployArgs
  Assert-LastExit 'OpenFGA Bicep deployment'
} finally {
  Remove-Item -Force $parametersFile -ErrorAction SilentlyContinue
}

if ($WhatIf) {
  Write-Host $deployOut
  Write-Host 'WhatIf complete - no Entra / store bootstrap.'
  exit 0
}

$deployment = $deployOut | ConvertFrom-Json
$outputs = $deployment.properties.outputs

function Get-Out([string]$Name) {
  return $outputs.$Name.value
}

$openfgaApiUrl = Get-Out 'openfgaApiUrl'
$openfgaFqdn = Get-Out 'openfgaFqdn'
Write-Host "OpenFGA URL: $openfgaApiUrl"

# --- Entra app registration (OIDC) -------------------------------------------------
$appObjectId = $null
$appClientId = $null
$spObjectId = $null
$appRoleId = $null

if (-not $SkipEntra) {
  Write-Step "Ensuring Entra app registration $OpenFgaAudience"
  $existingAppJson = az ad app list --filter "displayName eq '$OpenFgaAppDisplayName'" --query '[0]' -o json 2>$null
  $existingApp = if ($existingAppJson -and $existingAppJson -ne 'null') { $existingAppJson | ConvertFrom-Json } else { $null }

  if (-not $existingApp) {
    Write-Host "Creating app registration $OpenFgaAppDisplayName..."
    $createdJson = az ad app create `
      --display-name $OpenFgaAppDisplayName `
      --identifier-uris $OpenFgaAudience `
      --sign-in-audience AzureADMyOrg `
      -o json
    Assert-LastExit 'az ad app create'
    $existingApp = $createdJson | ConvertFrom-Json
  } else {
    Write-Host "App registration already exists ($($existingApp.appId))"
    $uris = @($existingApp.identifierUris)
    if ($uris -notcontains $OpenFgaAudience) {
      az ad app update --id $existingApp.appId --identifier-uris $OpenFgaAudience -o none
      Assert-LastExit 'az ad app update identifier-uris'
    }
  }

  $appObjectId = $existingApp.id
  $appClientId = $existingApp.appId

  # Application role required for MI client-credentials tokens (Graph PATCH)
  $appFullJson = az ad app show --id $appClientId -o json
  Assert-LastExit 'az ad app show'
  $appFull = $appFullJson | ConvertFrom-Json
  $appObjectId = $appFull.id
  $role = @($appFull.appRoles) | Where-Object { $_.value -eq $AppRoleValue } | Select-Object -First 1
  if (-not $role) {
    $appRoleId = [guid]::NewGuid().ToString()
    $appRolesPayload = @(
      @{
        allowedMemberTypes = @('Application')
        description        = 'Call OpenFGA Check/Write APIs'
        displayName        = 'OpenFGA Access'
        id                 = $appRoleId
        isEnabled          = $true
        value              = $AppRoleValue
      }
    )
    foreach ($r in @($appFull.appRoles)) {
      if ($r.value -ne $AppRoleValue) {
        $appRolesPayload += @{
          allowedMemberTypes = @($r.allowedMemberTypes)
          description        = $r.description
          displayName        = $r.displayName
          id                 = $r.id
          isEnabled          = [bool]$r.isEnabled
          value              = $r.value
        }
      }
    }
    $tmpRoles = Join-Path ([System.IO.Path]::GetTempPath()) ("openfga-approles-{0}.json" -f ([guid]::NewGuid().ToString('N')))
    (@{ appRoles = $appRolesPayload } | ConvertTo-Json -Depth 8) | Set-Content -Path $tmpRoles -Encoding utf8
    az rest --method PATCH `
      --url "https://graph.microsoft.com/v1.0/applications/$appObjectId" `
      --headers 'Content-Type=application/json' `
      --body "@$tmpRoles" `
      -o none
    $updateCode = $LASTEXITCODE
    Remove-Item -Force $tmpRoles -ErrorAction SilentlyContinue
    if ($updateCode -ne 0) {
      Write-Error 'Failed to set OpenFGA app roles via Microsoft Graph.'
      exit $updateCode
    }
    Write-Host "Created app role $AppRoleValue ($appRoleId)"
  } else {
    $appRoleId = $role.id
    Write-Host "App role $AppRoleValue already present ($appRoleId)"
  }

  $spJson = az ad sp list --filter "appId eq '$appClientId'" --query '[0]' -o json 2>$null
  $sp = if ($spJson -and $spJson -ne 'null') { $spJson | ConvertFrom-Json } else { $null }
  if (-not $sp) {
    $spJson = az ad sp create --id $appClientId -o json
    Assert-LastExit 'az ad sp create'
    $sp = $spJson | ConvertFrom-Json
  }
  $spObjectId = $sp.id

  Write-Host 'Setting enterprise app assignmentRequired=true'
  az ad sp update --id $spObjectId --set appRoleAssignmentRequired=true -o none
  Assert-LastExit 'az ad sp update appRoleAssignmentRequired'

  Write-Step "Assigning API App Service MI ($ApiWebAppName) as sole OpenFGA client"
  $apiIdentityJson = az webapp identity show --name $ApiWebAppName --resource-group $ResourceGroup -o json
  Assert-LastExit 'az webapp identity show'
  $apiIdentity = $apiIdentityJson | ConvertFrom-Json
  $apiPrincipalId = $apiIdentity.principalId
  if ([string]::IsNullOrWhiteSpace($apiPrincipalId)) {
    Write-Error "App Service $ApiWebAppName has no system-assigned managed identity."
    exit 1
  }

  $assignmentsJson = az rest --method GET `
    --url "https://graph.microsoft.com/v1.0/servicePrincipals/$spObjectId/appRoleAssignedTo" `
    -o json
  Assert-LastExit 'list appRoleAssignedTo'
  $assignments = ($assignmentsJson | ConvertFrom-Json).value

  $desired = @($assignments) | Where-Object { $_.principalId -eq $apiPrincipalId -and $_.appRoleId -eq $appRoleId }
  if (-not $desired) {
    $bodyObj = @{
      principalId = $apiPrincipalId
      resourceId  = $spObjectId
      appRoleId   = $appRoleId
    }
    $tmpBody = Join-Path ([System.IO.Path]::GetTempPath()) ("openfga-assign-{0}.json" -f ([guid]::NewGuid().ToString('N')))
    ($bodyObj | ConvertTo-Json -Compress) | Set-Content -Path $tmpBody -Encoding utf8
    az rest --method POST `
      --url "https://graph.microsoft.com/v1.0/servicePrincipals/$spObjectId/appRoleAssignedTo" `
      --headers 'Content-Type=application/json' `
      --body "@$tmpBody" `
      -o none
    $assignCode = $LASTEXITCODE
    Remove-Item -Force $tmpBody -ErrorAction SilentlyContinue
    if ($assignCode -ne 0) {
      Write-Error 'Failed to assign API managed identity to OpenFGA app role.'
      exit $assignCode
    }
    Write-Host "Assigned MI $apiPrincipalId -> $AppRoleValue"
  } else {
    Write-Host "API MI already assigned ($apiPrincipalId)"
  }

  # Remove any other assignees so the API MI remains the only identity
  foreach ($a in @($assignments)) {
    if ($a.principalId -ne $apiPrincipalId) {
      Write-Host "Removing unexpected assignee $($a.principalId) ($($a.principalDisplayName))"
      az rest --method DELETE `
        --url "https://graph.microsoft.com/v1.0/servicePrincipals/$spObjectId/appRoleAssignedTo/$($a.id)" `
        -o none
      if ($LASTEXITCODE -ne 0) {
        Write-Warning "Could not remove assignee $($a.principalId)"
      }
    }
  }
}

# --- Store + model bootstrap -------------------------------------------------------
$storeId = $null
$modelId = $null

function Wait-OpenFgaHealthy {
  Write-Step 'Waiting for OpenFGA /healthz'
  for ($i = 1; $i -le 36; $i++) {
    try {
      $resp = Invoke-WebRequest -Uri "$openfgaApiUrl/healthz" -UseBasicParsing -TimeoutSec 10
      if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 300) {
        return
      }
    } catch {
      # not ready yet
    }
    Start-Sleep -Seconds 5
  }
  # throw (not exit) so callers' try/finally can still restore OIDC
  throw "OpenFGA did not become healthy at $openfgaApiUrl/healthz"
}

function Set-OpenFgaAuthnMethod {
  param(
    [Parameter(Mandatory = $true)][string]$Method,
    [switch]$BestEffort
  )
  Write-Host "Setting OPENFGA_AUTHN_METHOD=$Method on $OpenFgaAppName"
  az containerapp update `
    --name $OpenFgaAppName `
    --resource-group $ResourceGroup `
    --set-env-vars "OPENFGA_AUTHN_METHOD=$Method" `
    -o none
  if ($LASTEXITCODE -ne 0) {
    if ($BestEffort) {
      Write-Warning "containerapp update authn=$Method failed (exit $LASTEXITCODE) - OpenFGA may still be unauthenticated"
      return
    }
    throw "containerapp update authn=$Method failed (exit $LASTEXITCODE)."
  }
  Wait-OpenFgaHealthy
  if ($Method -eq 'none') {
    # healthz is public under oidc too; wait until unauthenticated /stores works.
    Write-Host 'Waiting for unauthenticated /stores (authn=none revision)'
    for ($i = 1; $i -le 36; $i++) {
      try {
        Invoke-RestMethod -Uri "$openfgaApiUrl/stores" -TimeoutSec 15 | Out-Null
        return
      } catch {
        Start-Sleep -Seconds 5
      }
    }
    throw 'OpenFGA authn=none revision did not expose /stores without a bearer token.'
  }
}

if (-not $SkipBootstrap) {
  Wait-OpenFgaHealthy

  function Invoke-OpenFga {
    param(
      [string]$Method,
      [string]$Path,
      [object]$Body = $null
    )
    $uri = "$openfgaApiUrl$Path"
    $headers = @{ Accept = 'application/json' }
    if ($null -ne $Body) {
      $json = if ($Body -is [string]) { $Body } else { $Body | ConvertTo-Json -Depth 20 -Compress }
      return Invoke-RestMethod -Method $Method -Uri $uri -Headers ($headers + @{ 'Content-Type' = 'application/json' }) -Body $json
    }
    return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers
  }

  # Assignment-required OIDC means only the Nest API App Service MI can call OpenFGA.
  # Operators are not that MI, so briefly disable authn for store/model write, then
  # always restore oidc in finally (even on health-wait / Ctrl+C-style terminating errors).
  Write-Step 'Bootstrap window: OPENFGA_AUTHN_METHOD=none (store + model only)'
  try {
    Set-OpenFgaAuthnMethod -Method 'none'

    Write-Step "Ensuring OpenFGA store '$StoreName'"
    $stores = Invoke-OpenFga -Method GET -Path '/stores'
    $existingStore = @($stores.stores) | Where-Object { $_.name -eq $StoreName } | Select-Object -First 1
    if ($existingStore) {
      $storeId = $existingStore.id
      Write-Host "Reusing store $storeId"
    } else {
      $created = Invoke-OpenFga -Method POST -Path '/stores' -Body @{ name = $StoreName }
      $storeId = $created.id
      Write-Host "Created store $storeId"
    }

    Write-Step 'Pushing authorization model (model.json from model.fga)'
    $modelDoc = Get-Content -Path $modelJsonFile -Raw | ConvertFrom-Json
    $writeBody = @{
      schema_version   = $modelDoc.schema_version
      type_definitions = $modelDoc.type_definitions
    }
    if ($modelDoc.PSObject.Properties.Name -contains 'conditions' -and $modelDoc.conditions) {
      $writeBody.conditions = $modelDoc.conditions
    }
    $written = Invoke-OpenFga -Method POST -Path "/stores/$storeId/authorization-models" -Body $writeBody
    $modelId = $written.authorization_model_id
    if (-not $modelId) {
      throw 'OpenFGA did not return authorization_model_id.'
    }
    Write-Host "Authorization model id: $modelId"
  } finally {
    Write-Step 'Restoring OPENFGA_AUTHN_METHOD=oidc'
    Set-OpenFgaAuthnMethod -Method 'oidc' -BestEffort
  }

  if ([string]::IsNullOrWhiteSpace($storeId) -or [string]::IsNullOrWhiteSpace($modelId)) {
    Write-Error 'Bootstrap did not produce storeId/modelId; App Config not updated.'
    exit 1
  }

  Write-Step "Seeding App Configuration $AppConfigName (app:openfga:*)"
  function Set-AppConfigPlain([string]$Key, [string]$Value) {
    az appconfig kv set --name $AppConfigName --key $Key --value $Value --yes -o none
    Assert-LastExit "appconfig set $Key"
    Write-Host "  set $Key"
  }
  Set-AppConfigPlain 'app:openfga:apiUrl' $openfgaApiUrl
  Set-AppConfigPlain 'app:openfga:storeId' $storeId
  Set-AppConfigPlain 'app:openfga:authorizationModelId' $modelId
  Set-AppConfigPlain 'app:openfga:audience' $OpenFgaAudience
}

Write-Step 'Deployment summary (no secrets)'
[pscustomobject]@{
  SubscriptionId     = $SubscriptionId
  ResourceGroup      = $ResourceGroup
  ContainerApp       = $OpenFgaAppName
  Fqdn               = $openfgaFqdn
  ApiUrl             = $openfgaApiUrl
  Image              = "openfga/openfga:$OpenFgaImageTag"
  DatastoreEngine    = 'postgres (Neon openfga database; minReplicas=1)'
  KeyVaultSecrets    = 'openfga-database-url, openfga-database-url-unpooled'
  Audience           = $OpenFgaAudience
  EntraAppId         = $appClientId
  StoreId            = $storeId
  AuthorizationModel = $modelId
  AppConfig          = $AppConfigName
  ModelDsl           = $modelFgaFile
} | Format-List

Write-Host @'

Next:
  1. Restart Nest API so it reloads App Config (az webapp restart -n pocpk-api-si5fhs6dvxiha -g rg-poc-plattform-kit).
  2. PermissionsService acquires MI tokens for api://{tenantId}/ssd-pocpk-openfga/.default.
  3. Grant/Revoke + tuple sync remain separate tickets.

OIDC CI note: run this script from a principal logged in via the same GitHub OIDC
Variables as preview-api.yml (AZURE_CLIENT_ID / TENANT_ID / SUBSCRIPTION_ID). Never
put deploy tokens or AZURE_CREDENTIALS in GitHub Secrets.

'@ -ForegroundColor Green
