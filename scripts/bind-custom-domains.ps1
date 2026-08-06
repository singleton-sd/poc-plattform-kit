<#
.SYNOPSIS
  Bind Azure custom domains + optional managed TLS from a JSON config.

.DESCRIPTION
  Reads bindings[] from infra/custom-domains.*.json:
    - kind=swa        -> az staticwebapp hostname set
    - kind=appservice -> az webapp config hostname add
                        (+ managed cert create/bind when managedCert=true)

  SWA hostname set waits for Azure validation (can take several minutes).

.PARAMETER ConfigPath
  Path to a custom-domains JSON file. Default: infra/custom-domains.pocpk.json

.PARAMETER SkipManagedCert
  Bind App Service hostnames only (no cert create/bind).

.EXAMPLE
  powershell -File ./scripts/bind-custom-domains.ps1

.EXAMPLE
  powershell -File ./scripts/bind-custom-domains.ps1 -ConfigPath ./infra/custom-domains.other.json
#>
[CmdletBinding()]
param(
  [string]$ConfigPath = '',
  [string]$ResourceGroup = '',
  [switch]$SkipManagedCert
)

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
if (-not $ConfigPath) {
  $ConfigPath = Join-Path $repoRoot 'infra/custom-domains.pocpk.json'
}
if (-not (Test-Path $ConfigPath)) {
  throw "Config not found: $ConfigPath"
}

$config = Get-Content -Path $ConfigPath -Raw -Encoding utf8 | ConvertFrom-Json
if (-not $ResourceGroup) {
  $ResourceGroup = [string]$config.resourceGroup
}
if ([string]::IsNullOrWhiteSpace($ResourceGroup)) {
  throw 'Resource group required via -ResourceGroup or config.resourceGroup'
}
if (-not $config.bindings -or $config.bindings.Count -eq 0) {
  throw 'Config.bindings must contain at least one binding'
}

Write-Host "Binding $($config.bindings.Count) hostname(s) from $ConfigPath (RG=$ResourceGroup)"

foreach ($b in $config.bindings) {
  $kind = ([string]$b.kind).ToLowerInvariant()
  $name = [string]$b.resourceName
  $hostName = [string]$b.hostname
  $rg = if ($b.resourceGroup) { [string]$b.resourceGroup } else { $ResourceGroup }
  if ([string]::IsNullOrWhiteSpace($kind) -or [string]::IsNullOrWhiteSpace($name) -or [string]::IsNullOrWhiteSpace($hostName)) {
    throw 'Each binding needs kind, resourceName, and hostname'
  }

  switch ($kind) {
    'swa' {
      Write-Host "==> SWA hostname $hostName on $name"
      az staticwebapp hostname set -n $name -g $rg --hostname $hostName
      if ($LASTEXITCODE -ne 0) { throw "SWA hostname set failed for $hostName" }
    }
    'appservice' {
      Write-Host "==> App Service hostname $hostName on $name"
      az webapp config hostname add --webapp-name $name -g $rg --hostname $hostName
      if ($LASTEXITCODE -ne 0) { throw "App Service hostname add failed for $hostName" }

      $wantCert = (-not $SkipManagedCert) -and ($b.managedCert -eq $true)
      if ($wantCert) {
        Write-Host "==> Managed cert for $hostName"
        $certJson = az webapp config ssl create -g $rg -n $name --hostname $hostName -o json 2>&1
        if ($LASTEXITCODE -ne 0) {
          Write-Warning "ssl create returned non-zero (may still be in progress): $certJson"
        }
        $thumb = $null
        for ($i = 1; $i -le 24; $i++) {
          $show = az webapp config ssl show -g $rg --certificate-name $hostName -o json 2>$null
          if ($LASTEXITCODE -eq 0 -and $show) {
            $obj = $show | ConvertFrom-Json
            $thumb = $obj.thumbprint
            if (-not $thumb) { $thumb = $obj.properties.thumbprint }
            if ($thumb) { break }
          }
          Write-Host "  waiting for managed cert (attempt $i)..."
          Start-Sleep -Seconds 15
        }
        if (-not $thumb) {
          throw "Managed cert for $hostName not ready. Re-run later or bind manually."
        }
        Write-Host "==> Bind SNI cert $thumb"
        az webapp config ssl bind -g $rg -n $name --certificate-thumbprint $thumb --ssl-type SNI
        if ($LASTEXITCODE -ne 0) { throw "SSL bind failed for $hostName" }
      }
    }
    default {
      throw "Unknown binding.kind '$kind' (expected swa|appservice)"
    }
  }
}

Write-Host 'Done. Smoke HTTPS for each binding hostname.'
foreach ($b in $config.bindings) {
  Write-Host ("  https://{0}" -f $b.hostname)
}
