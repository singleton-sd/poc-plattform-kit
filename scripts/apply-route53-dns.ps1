<#
.SYNOPSIS
  Upsert Route53 records from a reusable custom-domains JSON config.

.DESCRIPTION
  Reads infra/custom-domains.*.json (records[]). Requires AWS CLI with write
  access to the hosted zone. Prefers `aws` on PATH; falls back to
  `python -m awscli`. Writes UTF-8 without BOM (AWS rejects BOM). Safe UPSERT.

.PARAMETER ConfigPath
  Path to a custom-domains JSON file. Default: infra/custom-domains.pocpk.json

.PARAMETER HostedZoneId
  Override hosted zone id (otherwise from config or zoneDomain lookup).

.PARAMETER WhatIf
  Print the change batch without calling Route53.

.EXAMPLE
  # Platform Kit PoC (default config)
  powershell -File ./scripts/apply-route53-dns.ps1

.EXAMPLE
  # Another product / domain map
  powershell -File ./scripts/apply-route53-dns.ps1 -ConfigPath ./infra/custom-domains.other.json
#>
[CmdletBinding(SupportsShouldProcess)]
param(
  [string]$ConfigPath = '',
  [string]$HostedZoneId = '',
  [switch]$WhatIf
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
$zoneDomain = [string]$config.zoneDomain
if ([string]::IsNullOrWhiteSpace($zoneDomain)) {
  throw 'Config.zoneDomain is required (e.g. singletonsd.com)'
}
if (-not $config.records -or $config.records.Count -eq 0) {
  throw 'Config.records must contain at least one record'
}

$usePythonAws = $false
if (Get-Command aws -ErrorAction SilentlyContinue) {
  $usePythonAws = $false
}
elseif ((& python -m awscli --version 2>$null)) {
  $usePythonAws = $true
}
else {
  throw 'AWS CLI not found. Install awscli (pip/winget) and configure credentials, then re-run.'
}

function Invoke-Aws {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$AwsArgs)
  if ($usePythonAws) {
    & python -m awscli @AwsArgs
  }
  else {
    & aws @AwsArgs
  }
  if ($LASTEXITCODE -ne 0) {
    throw "aws exited with code $LASTEXITCODE"
  }
}

if (-not $HostedZoneId) {
  $HostedZoneId = [string]$config.hostedZoneId
}
if (-not $HostedZoneId) {
  $query = "HostedZones[?Name==``$zoneDomain.``].[Id,Name]"
  $zonesJson = Invoke-Aws route53 list-hosted-zones-by-name --dns-name $zoneDomain --query $query --output json
  $zones = $zonesJson | ConvertFrom-Json
  if (-not $zones -or $zones.Count -eq 0) {
    throw "No Route53 hosted zone found for $zoneDomain"
  }
  $HostedZoneId = ($zones[0][0] -replace '^/hostedzone/', '')
}
Write-Host "Using hosted zone $HostedZoneId ($zoneDomain) from $ConfigPath"

$defaultTtl = 300
if ($config.ttlSeconds) { $defaultTtl = [int]$config.ttlSeconds }

$changes = @()
foreach ($rec in $config.records) {
  $rel = [string]$rec.name
  $type = ([string]$rec.type).ToUpperInvariant()
  $value = [string]$rec.value
  if ([string]::IsNullOrWhiteSpace($rel) -or [string]::IsNullOrWhiteSpace($type) -or [string]::IsNullOrWhiteSpace($value)) {
    throw 'Each record needs name, type, and value'
  }
  $fqdn = if ($rel.EndsWith(".$zoneDomain") -or $rel -eq $zoneDomain) { $rel } else { "$rel.$zoneDomain" }
  $ttl = if ($rec.ttl) { [int]$rec.ttl } else { $defaultTtl }

  $rrValue = if ($type -eq 'TXT') {
    if ($value.StartsWith('"')) { $value } else { "`"$value`"" }
  }
  else {
    $value
  }

  $changes += @{
    Action            = 'UPSERT'
    ResourceRecordSet = @{
      Name            = $fqdn
      Type            = $type
      TTL             = $ttl
      ResourceRecords = @(@{ Value = $rrValue })
    }
  }
}

$comment = if ($config.comment) { [string]$config.comment } else { "custom domains for $zoneDomain" }
$batch = @{
  Comment = $comment
  Changes = $changes
}

$tmp = Join-Path $env:TEMP ("custom-domains-route53-{0}.json" -f ([guid]::NewGuid().ToString('N').Substring(0, 8)))
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($tmp, ($batch | ConvertTo-Json -Depth 8), $utf8NoBom)
Write-Host "Change batch ($($changes.Count) records) -> $tmp"

if ($WhatIf -or $PSCmdlet.ShouldProcess("hosted zone $HostedZoneId", 'UPSERT Route53 records')) {
  if ($WhatIf) {
    Get-Content $tmp
    Write-Host 'WhatIf: no Route53 call made.'
    return
  }
  Invoke-Aws route53 change-resource-record-sets --hosted-zone-id $HostedZoneId --change-batch "file://$tmp"
  Write-Host 'Done. Wait for DNS propagation, then run scripts/bind-custom-domains.ps1 -ConfigPath ...'
}
