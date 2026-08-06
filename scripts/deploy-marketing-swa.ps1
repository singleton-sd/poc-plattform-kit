<#
.SYNOPSIS
  Back-compat wrapper — prefer deploy-swa-from-kv.ps1 -DeployName marketing
#>
[CmdletBinding()]
param(
  [string]$VaultName = '',
  [string]$SecretName = '',
  [string]$AppLocation = ''
)
& (Join-Path $PSScriptRoot 'deploy-swa-from-kv.ps1') `
  -DeployName marketing `
  -VaultName $VaultName `
  -SecretName $SecretName `
  -AppLocation $AppLocation
