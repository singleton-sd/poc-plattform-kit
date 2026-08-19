<#
.SYNOPSIS
  Idempotent Forward Email domain + Route53 DNS + alias provisioning.

.DESCRIPTION
  Ensures a Forward Email domain exists, upserts required Route53 DNS (MX, SPF,
  verification TXT, DKIM, Return-Path, optional DMARC), verifies records/SMTP
  with limited retries, and ensures a forwarding alias.

  Requires FORWARD_EMAIL_TOKEN (Process/User/Machine). Never prints the token
  or Authorization header. Prefers `aws` on PATH; falls back to `python -m awscli`.
  Change batches are written UTF-8 without BOM.

.PARAMETER Domain
  Mail domain to provision. Default: mail.plattform-kit.poc.singletonsd.com

.PARAMETER ZoneDomain
  Parent Route53 hosted zone name. Default: singletonsd.com

.PARAMETER Alias
  Alias local-part to ensure. Default: noreply

.PARAMETER AliasRecipient
  Forwarding recipient for the alias. Default: hello@singletonsd.com

.PARAMETER HostedZoneId
  Optional Route53 hosted zone id (otherwise looked up from ZoneDomain).

.PARAMETER DryRun
  Print planned API/DNS actions without mutating Route53 or creating aliases
  when already present. Domain GET still runs; domain POST is skipped when
  DryRun and domain is missing (reports what would be created).

.PARAMETER SkipDns
  Skip Route53 reads/writes.

.PARAMETER SkipVerify
  Skip verify-records / verify-smtp calls.

.PARAMETER ForceDmarc
  Overwrite an existing DMARC TXT on the exact Forward Email DMARC name even
  when it differs from the API value.

.PARAMETER MaxVerifyAttempts
  Max verify-records / verify-smtp attempts. Default: 6

.PARAMETER VerifyDelaySeconds
  Delay between verify attempts. Default: 20

.EXAMPLE
  powershell -File ./scripts/provision-forward-email.ps1

.EXAMPLE
  powershell -File ./scripts/provision-forward-email.ps1 -DryRun -SkipVerify

.EXAMPLE
  # Provision a second PoC mail domain + alias
  powershell -File ./scripts/provision-forward-email.ps1 `
    -Domain mail.inkads.poc.singletonsd.com `
    -ZoneDomain singletonsd.com `
    -Alias noreply `
    -AliasRecipient inkads-support@singletonsd.com
#>
[CmdletBinding(SupportsShouldProcess)]
param(
  [string]$Domain = 'mail.plattform-kit.poc.singletonsd.com',
  [string]$ZoneDomain = 'singletonsd.com',
  [string]$Alias = 'noreply',
  [string]$AliasRecipient = 'hello@singletonsd.com',
  [string]$HostedZoneId = '',
  [switch]$DryRun,
  [switch]$SkipDns,
  [switch]$SkipVerify,
  [switch]$ForceDmarc,
  [int]$MaxVerifyAttempts = 6,
  [int]$VerifyDelaySeconds = 20
)

$ErrorActionPreference = 'Stop'
$ForwardEmailBaseUrl = 'https://api.forwardemail.net'
$DefaultTtl = 300

function Get-ForwardEmailToken {
  foreach ($scope in @('Process', 'User', 'Machine')) {
    $value = [Environment]::GetEnvironmentVariable('FORWARD_EMAIL_TOKEN', $scope)
    if (-not [string]::IsNullOrWhiteSpace($value)) {
      return $value.Trim()
    }
  }
  throw 'FORWARD_EMAIL_TOKEN is required (set User/Process/Machine env). Never commit the token.'
}

function Get-BasicAuthHeaderValue {
  param([Parameter(Mandatory)][string]$Token)
  $bytes = [System.Text.Encoding]::UTF8.GetBytes("${Token}:")
  return 'Basic ' + [Convert]::ToBase64String($bytes)
}

function Invoke-ForwardEmailApi {
  param(
    [Parameter(Mandatory)][string]$Method,
    [Parameter(Mandatory)][string]$Path,
    [hashtable]$Form = $null,
    [Parameter(Mandatory)][string]$AuthHeader
  )

  $uri = "$ForwardEmailBaseUrl$Path"
  $headers = @{ Authorization = $AuthHeader }
  try {
    if ($null -ne $Form) {
      return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers -Body $Form -ContentType 'application/x-www-form-urlencoded'
    }
    return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers
  }
  catch {
    $response = $_.Exception.Response
    $statusCode = $null
    $bodyText = ''
    if ($response) {
      $statusCode = [int]$response.StatusCode
      try {
        $stream = $response.GetResponseStream()
        if ($stream) {
          $reader = New-Object System.IO.StreamReader($stream)
          $bodyText = $reader.ReadToEnd()
          $reader.Dispose()
        }
      }
      catch {
        # Ignore body read failures; status is enough for control flow.
      }
    }
    return [pscustomobject]@{
      __error      = $true
      StatusCode   = $statusCode
      BodyText     = $bodyText
      ExceptionMsg = $_.Exception.Message
    }
  }
}

function Assert-ForwardEmailOk {
  param(
    $Result,
    [Parameter(Mandatory)][string]$Operation
  )
  if ($Result -and $Result.PSObject.Properties.Name -contains '__error' -and $Result.__error) {
    $code = $Result.StatusCode
    if ($code) {
      throw "$Operation failed (HTTP $code)."
    }
    throw "$Operation failed."
  }
  return $Result
}

function Merge-SpfInclude {
  param(
    [string]$ExistingSpf,
    [string]$IncludeHost = 'spf.forwardemail.net'
  )
  $include = "include:$IncludeHost"
  if ([string]::IsNullOrWhiteSpace($ExistingSpf)) {
    return "v=spf1 $include -all"
  }
  $trimmed = $ExistingSpf.Trim().Trim('"')
  if (-not $trimmed.ToLowerInvariant().StartsWith('v=spf1')) {
    return "v=spf1 $include -all"
  }
  if ($trimmed.Contains($include)) {
    return $trimmed
  }
  if ($trimmed -match '\s(-all|~all|\?all|\+all)\s*$') {
    return ($trimmed -replace '\s(-all|~all|\?all|\+all)\s*$', " $include `$1")
  }
  return "$trimmed $include -all"
}

function Format-VerificationTxt {
  param([Parameter(Mandatory)][string]$VerificationRecord)
  $v = $VerificationRecord.Trim().Trim('"')
  if ($v.StartsWith('forward-email-site-verification=')) {
    return $v
  }
  return "forward-email-site-verification=$v"
}

function Get-RelativeName {
  param(
    [Parameter(Mandatory)][string]$FqdnOrRelative,
    [Parameter(Mandatory)][string]$Zone
  )
  $cleaned = $FqdnOrRelative.Trim().TrimEnd('.')
  if ($cleaned -eq $Zone) { return '' }
  if ($cleaned.EndsWith(".$Zone")) {
    return $cleaned.Substring(0, $cleaned.Length - ($Zone.Length + 1))
  }
  return $cleaned
}

function Get-Fqdn {
  param(
    [string]$Relative,
    [Parameter(Mandatory)][string]$Zone
  )
  if ([string]::IsNullOrWhiteSpace($Relative) -or $Relative -eq '@') {
    return $Zone
  }
  $cleaned = $Relative.Trim().TrimEnd('.')
  if ($cleaned.EndsWith(".$Zone") -or $cleaned -eq $Zone) {
    return $cleaned
  }
  return "$cleaned.$Zone"
}

function Write-Utf8NoBomJson {
  param(
    [Parameter(Mandatory)][string]$Path,
    [Parameter(Mandatory)]$Object
  )
  $json = $Object | ConvertTo-Json -Depth 12
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($Path, $json, $utf8NoBom)
}

# --- AWS CLI bootstrap (same pattern as apply-route53-dns.ps1) ---
$usePythonAws = $false
if (-not $SkipDns) {
  if (Get-Command aws -ErrorAction SilentlyContinue) {
    $usePythonAws = $false
  }
  elseif ((& python -m awscli --version 2>$null)) {
    $usePythonAws = $true
  }
  else {
    throw 'AWS CLI not found. Install awscli (pip/winget) and configure credentials, or pass -SkipDns.'
  }
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

function Get-Route53RecordsForName {
  param(
    [Parameter(Mandatory)][string]$ZoneId,
    [Parameter(Mandatory)][string]$Fqdn,
    [Parameter(Mandatory)][ValidateSet('TXT', 'MX', 'CNAME')][string]$Type
  )
  $nameWithDot = if ($Fqdn.EndsWith('.')) { $Fqdn } else { "$Fqdn." }
  $json = Invoke-Aws route53 list-resource-record-sets `
    --hosted-zone-id $ZoneId `
    --start-record-name $nameWithDot `
    --start-record-type $Type `
    --max-items 20 `
    --output json
  $parsed = $json | ConvertFrom-Json
  $matches = @()
  foreach ($rrs in @($parsed.ResourceRecordSets)) {
    $rrName = ([string]$rrs.Name).TrimEnd('.')
    $want = $Fqdn.TrimEnd('.')
    if ($rrName -eq $want -and ([string]$rrs.Type).ToUpperInvariant() -eq $Type) {
      $matches += $rrs
    }
  }
  return $matches
}

function Get-TxtValues {
  param($ResourceRecordSet)
  if (-not $ResourceRecordSet) { return @() }
  $values = @()
  foreach ($rr in @($ResourceRecordSet.ResourceRecords)) {
    $raw = [string]$rr.Value
    # Route53 returns quoted TXT; strip wrapping quotes for comparisons.
    if ($raw.Length -ge 2 -and $raw.StartsWith('"') -and $raw.EndsWith('"')) {
      $raw = $raw.Substring(1, $raw.Length - 2)
    }
    $values += $raw
  }
  return $values
}

function Format-Route53TxtValue {
  param([Parameter(Mandatory)][string]$Value)
  $v = $Value.Trim()
  if ($v.StartsWith('"') -and $v.EndsWith('"')) { return $v }
  return "`"$v`""
}

function Format-Route53MxValue {
  param(
    [Parameter(Mandatory)][int]$Priority,
    [Parameter(Mandatory)][string]$MailHost
  )
  $h = $MailHost.Trim().TrimEnd('.')
  return "$Priority ${h}."
}

function Format-Route53CnameValue {
  param([Parameter(Mandatory)][string]$Target)
  $t = $Target.Trim().TrimEnd('.')
  return "${t}."
}

function New-Change {
  param(
    [Parameter(Mandatory)][string]$Name,
    [Parameter(Mandatory)][string]$Type,
    [Parameter(Mandatory)][object[]]$ResourceRecords,
    [int]$Ttl = $DefaultTtl
  )
  return @{
    Action            = 'UPSERT'
    ResourceRecordSet = @{
      Name            = $Name
      Type            = $Type
      TTL             = $Ttl
      ResourceRecords = $ResourceRecords
    }
  }
}

# --- Resolve token (never log) ---
$token = Get-ForwardEmailToken
$authHeader = Get-BasicAuthHeaderValue -Token $token
# Drop locals that are only needed for auth construction later reuse is via $authHeader.
Remove-Variable token -ErrorAction SilentlyContinue

if (-not $Domain.EndsWith(".$ZoneDomain") -and $Domain -ne $ZoneDomain) {
  throw "Domain '$Domain' is not under zone '$ZoneDomain'."
}
$relativeDomain = Get-RelativeName -FqdnOrRelative $Domain -Zone $ZoneDomain
Write-Host "Provisioning Forward Email domain: $Domain (zone $ZoneDomain)"

# --- Ensure domain ---
$domainResult = Invoke-ForwardEmailApi -Method GET -Path "/v1/domains/$([uri]::EscapeDataString($Domain))" -AuthHeader $authHeader
$domainObj = $null
$createdDomain = $false

if ($domainResult -and $domainResult.PSObject.Properties.Name -contains '__error' -and $domainResult.__error) {
  if ($domainResult.StatusCode -eq 404) {
    Write-Host "Domain not found in Forward Email; will create."
    if ($DryRun) {
      Write-Host "WhatIf: would POST /v1/domains domain=$Domain plan=team."
    }
    else {
      $createBody = @{ domain = $Domain; plan = 'team' }
      $created = Invoke-ForwardEmailApi -Method POST -Path '/v1/domains' -Form $createBody -AuthHeader $authHeader
      if ($created -and $created.PSObject.Properties.Name -contains '__error' -and $created.__error) {
        # Race: re-GET
        $domainResult = Invoke-ForwardEmailApi -Method GET -Path "/v1/domains/$([uri]::EscapeDataString($Domain))" -AuthHeader $authHeader
        $domainObj = Assert-ForwardEmailOk -Result $domainResult -Operation 'GET domain after create race'
      }
      else {
        $domainObj = $created
        $createdDomain = $true
      }
    }
  }
  else {
    Assert-ForwardEmailOk -Result $domainResult -Operation 'GET domain' | Out-Null
  }
}
else {
  $domainObj = $domainResult
  Write-Host "Domain already exists in Forward Email."
}

if (-not $domainObj -and -not $DryRun) {
  $domainResult = Invoke-ForwardEmailApi -Method GET -Path "/v1/domains/$([uri]::EscapeDataString($Domain))" -AuthHeader $authHeader
  $domainObj = Assert-ForwardEmailOk -Result $domainResult -Operation 'GET domain'
}

if ($createdDomain) {
  Write-Host 'Created Forward Email domain.'
}

if (-not $domainObj -and $DryRun) {
  Write-Host 'WhatIf: skipping DNS/alias that require API domain payload.'
  exit 0
}

$verificationRaw = [string]$domainObj.verification_record
if ([string]::IsNullOrWhiteSpace($verificationRaw)) {
  throw 'Forward Email domain response missing verification_record.'
}
$verificationTxt = Format-VerificationTxt -VerificationRecord $verificationRaw
$smtpDns = $domainObj.smtp_dns_records

# --- Route53 ---
$pendingDns = $false
if (-not $SkipDns) {
  if (-not $HostedZoneId) {
    $query = "HostedZones[?Name==``$ZoneDomain.``].[Id,Name]"
    $zonesJson = Invoke-Aws route53 list-hosted-zones-by-name --dns-name $ZoneDomain --query $query --output json
    $zones = $zonesJson | ConvertFrom-Json
    if (-not $zones -or $zones.Count -eq 0) {
      throw "No Route53 hosted zone found for $ZoneDomain"
    }
    $HostedZoneId = ($zones[0][0] -replace '^/hostedzone/', '')
  }
  Write-Host "Using hosted zone $HostedZoneId ($ZoneDomain)"

  $apexFqdn = Get-Fqdn -Relative $relativeDomain -Zone $ZoneDomain
  $changes = @()
  $apexCnameConflict = $false

  $existingCnameSets = @(Get-Route53RecordsForName -ZoneId $HostedZoneId -Fqdn $apexFqdn -Type CNAME)
  if ($existingCnameSets.Count -gt 0) {
    $apexCnameConflict = $true
    Write-Warning @"
DNS conflict: $apexFqdn already has a CNAME.
RFC 1034 forbids MX/TXT alongside a CNAME on the same name.
Skipping apex verification TXT, SPF, and MX upserts.
Will still apply child records (DKIM, Return-Path, DMARC) which do not conflict.
PoC mail domain is mail.plattform-kit.poc.singletonsd.com (no website CNAME).
Re-run with that -Domain (script default) so noreply@$Domain can fully verify.
"@
  }

  if (-not $apexCnameConflict) {
  # Existing apex TXT (SPF + verification + unrelated)
  $existingTxtSets = @(Get-Route53RecordsForName -ZoneId $HostedZoneId -Fqdn $apexFqdn -Type TXT)
  $existingTxt = if ($existingTxtSets.Count -gt 0) { $existingTxtSets[0] } else { $null }
  $existingTxtValues = @(Get-TxtValues -ResourceRecordSet $existingTxt)

  $existingSpf = $null
  foreach ($tv in $existingTxtValues) {
    if ($tv.ToLowerInvariant().StartsWith('v=spf1')) {
      $existingSpf = $tv
      break
    }
  }
  $mergedSpf = Merge-SpfInclude -ExistingSpf $existingSpf

  $desiredApexTxt = New-Object System.Collections.Generic.List[string]
  foreach ($tv in $existingTxtValues) {
    $lower = $tv.ToLowerInvariant()
    if ($lower.StartsWith('v=spf1')) { continue }
    if ($lower.StartsWith('forward-email-site-verification=')) { continue }
    $desiredApexTxt.Add($tv) | Out-Null
  }
  $desiredApexTxt.Add($mergedSpf) | Out-Null
  $desiredApexTxt.Add($verificationTxt) | Out-Null

  $apexTxtRecords = @()
  foreach ($v in ($desiredApexTxt | Select-Object -Unique)) {
    $apexTxtRecords += @{ Value = (Format-Route53TxtValue -Value $v) }
  }
  $changes += New-Change -Name $apexFqdn -Type TXT -ResourceRecords $apexTxtRecords

  # MX mx1/10 + mx2/20 (replace MX set for this name)
  $mxRecords = @(
    @{ Value = (Format-Route53MxValue -Priority 10 -MailHost 'mx1.forwardemail.net') },
    @{ Value = (Format-Route53MxValue -Priority 20 -MailHost 'mx2.forwardemail.net') }
  )
  $changes += New-Change -Name $apexFqdn -Type MX -ResourceRecords $mxRecords
  }
  # DKIM TXT from API
  if ($smtpDns -and $smtpDns.dkim -and $smtpDns.dkim.name -and $smtpDns.dkim.value) {
    $dkimRel = Get-RelativeName -FqdnOrRelative ([string]$smtpDns.dkim.name) -Zone $ZoneDomain
    $dkimFqdn = Get-Fqdn -Relative $dkimRel -Zone $ZoneDomain
    $dkimValue = ([string]$smtpDns.dkim.value).Trim().Trim('"')
    $existingDkimSets = @(Get-Route53RecordsForName -ZoneId $HostedZoneId -Fqdn $dkimFqdn -Type TXT)
    $existingDkim = if ($existingDkimSets.Count -gt 0) { $existingDkimSets[0] } else { $null }
    $dkimValues = New-Object System.Collections.Generic.List[string]
    foreach ($tv in @(Get-TxtValues -ResourceRecordSet $existingDkim)) {
      if ($tv -ne $dkimValue) { $dkimValues.Add($tv) | Out-Null }
    }
    $dkimValues.Add($dkimValue) | Out-Null
    $dkimRr = @()
    foreach ($v in $dkimValues) {
      $dkimRr += @{ Value = (Format-Route53TxtValue -Value $v) }
    }
    $changes += New-Change -Name $dkimFqdn -Type TXT -ResourceRecords $dkimRr
  }
  else {
    Write-Host 'Warning: smtp_dns_records.dkim missing; skipping DKIM upsert.'
  }

  # Return-Path CNAME from API
  if ($smtpDns -and $smtpDns.return_path -and $smtpDns.return_path.name -and $smtpDns.return_path.value) {
    $rpRel = Get-RelativeName -FqdnOrRelative ([string]$smtpDns.return_path.name) -Zone $ZoneDomain
    $rpFqdn = Get-Fqdn -Relative $rpRel -Zone $ZoneDomain
    $rpTarget = Format-Route53CnameValue -Target ([string]$smtpDns.return_path.value)
    $changes += New-Change -Name $rpFqdn -Type CNAME -ResourceRecords @(@{ Value = $rpTarget })
  }
  else {
    Write-Host 'Warning: smtp_dns_records.return_path missing; skipping Return-Path upsert.'
  }

  # DMARC TXT — skip overwrite on organisational conflict unless -ForceDmarc
  if ($smtpDns -and $smtpDns.dmarc -and $smtpDns.dmarc.name -and $smtpDns.dmarc.value) {
    $dmarcRel = Get-RelativeName -FqdnOrRelative ([string]$smtpDns.dmarc.name) -Zone $ZoneDomain
    $dmarcFqdn = Get-Fqdn -Relative $dmarcRel -Zone $ZoneDomain
    $dmarcValue = ([string]$smtpDns.dmarc.value).Trim().Trim('"')
    $existingDmarcSets = @(Get-Route53RecordsForName -ZoneId $HostedZoneId -Fqdn $dmarcFqdn -Type TXT)
    $existingDmarc = if ($existingDmarcSets.Count -gt 0) { $existingDmarcSets[0] } else { $null }
    $existingDmarcValues = @(Get-TxtValues -ResourceRecordSet $existingDmarc)
    $conflict = $false
    foreach ($tv in $existingDmarcValues) {
      if ($tv.ToLowerInvariant().StartsWith('v=dmarc1') -and $tv -ne $dmarcValue) {
        $conflict = $true
        break
      }
    }
    if ($conflict -and -not $ForceDmarc) {
      Write-Warning "Existing DMARC on $dmarcFqdn differs from Forward Email; skipping overwrite (pass -ForceDmarc to replace)."
    }
    else {
      $dmarcValues = New-Object System.Collections.Generic.List[string]
      foreach ($tv in $existingDmarcValues) {
        if ($tv.ToLowerInvariant().StartsWith('v=dmarc1')) { continue }
        if ($tv -eq $dmarcValue) { continue }
        $dmarcValues.Add($tv) | Out-Null
      }
      $dmarcValues.Add($dmarcValue) | Out-Null
      $dmarcRr = @()
      foreach ($v in $dmarcValues) {
        $dmarcRr += @{ Value = (Format-Route53TxtValue -Value $v) }
      }
      $changes += New-Change -Name $dmarcFqdn -Type TXT -ResourceRecords $dmarcRr
    }
  }
  else {
    Write-Host 'Info: smtp_dns_records.dmarc missing; no DMARC upsert.'
  }

  $batch = @{
    Comment = "Forward Email DNS for $Domain"
    Changes = $changes
  }
  $tmp = Join-Path $env:TEMP ("forward-email-route53-{0}.json" -f ([guid]::NewGuid().ToString('N').Substring(0, 8)))
  Write-Utf8NoBomJson -Path $tmp -Object $batch
  Write-Host "Change batch ($($changes.Count) changes) -> $tmp"

  if ($DryRun -or -not $PSCmdlet.ShouldProcess("hosted zone $HostedZoneId", 'UPSERT Forward Email DNS')) {
    if ($DryRun) {
      Get-Content $tmp
      Write-Host 'WhatIf: no Route53 call made.'
    }
  }
  else {
    Invoke-Aws route53 change-resource-record-sets --hosted-zone-id $HostedZoneId --change-batch "file://$tmp"
    Write-Host 'Route53 UPSERT submitted.'
    $pendingDns = $true
  }
}
else {
  Write-Host 'SkipDns: not reading or writing Route53.'
}

# --- Verify records / SMTP ---
$verifyPending = $false
if (-not $SkipVerify -and -not $DryRun) {
  $recordsOk = $false
  $smtpOk = $false
  for ($attempt = 1; $attempt -le $MaxVerifyAttempts; $attempt++) {
    Write-Host "Verify attempt $attempt / $MaxVerifyAttempts"
    $vr = Invoke-ForwardEmailApi -Method GET -Path "/v1/domains/$([uri]::EscapeDataString($Domain))/verify-records" -AuthHeader $authHeader
    if (-not ($vr -and $vr.PSObject.Properties.Name -contains '__error' -and $vr.__error)) {
      $recordsOk = $true
      Write-Host 'verify-records: OK'
    }
    else {
      Write-Host "verify-records: pending/failed (HTTP $($vr.StatusCode))"
    }

    $vs = Invoke-ForwardEmailApi -Method GET -Path "/v1/domains/$([uri]::EscapeDataString($Domain))/verify-smtp" -AuthHeader $authHeader
    if (-not ($vs -and $vs.PSObject.Properties.Name -contains '__error' -and $vs.__error)) {
      $smtpOk = $true
      Write-Host 'verify-smtp: OK'
    }
    else {
      Write-Host "verify-smtp: pending/failed (HTTP $($vs.StatusCode))"
    }

    if ($recordsOk -and $smtpOk) { break }
    if ($attempt -lt $MaxVerifyAttempts) {
      Start-Sleep -Seconds $VerifyDelaySeconds
    }
  }

  if (-not ($recordsOk -and $smtpOk)) {
    $verifyPending = $true
    Write-Host ''
    Write-Host 'DNS verification still pending (propagation can take minutes).'
    Write-Host 'Re-run this script later; it is idempotent. Exit 0.'
  }
}
elseif ($SkipVerify) {
  Write-Host 'SkipVerify: not calling verify-records / verify-smtp.'
}

# --- Ensure alias ---
if (-not $DryRun) {
  $aliases = Invoke-ForwardEmailApi -Method GET -Path "/v1/domains/$([uri]::EscapeDataString($Domain))/aliases?pagination=true&limit=50" -AuthHeader $authHeader
  $aliases = Assert-ForwardEmailOk -Result $aliases -Operation 'GET aliases'
  $aliasList = @($aliases)
  $existingAlias = $aliasList | Where-Object { ([string]$_.name).ToLowerInvariant() -eq $Alias.ToLowerInvariant() } | Select-Object -First 1
  if ($existingAlias) {
    Write-Host "Alias '$Alias' already exists (id=$($existingAlias.id))."
  }
  else {
    Write-Host "Creating alias '$Alias' -> $AliasRecipient"
    $aliasBody = @{
      name       = $Alias
      recipients = $AliasRecipient
    }
    $createdAlias = Invoke-ForwardEmailApi -Method POST -Path "/v1/domains/$([uri]::EscapeDataString($Domain))/aliases" -Form $aliasBody -AuthHeader $authHeader
    if ($createdAlias -and $createdAlias.PSObject.Properties.Name -contains '__error' -and $createdAlias.__error) {
      $aliasesAgain = Invoke-ForwardEmailApi -Method GET -Path "/v1/domains/$([uri]::EscapeDataString($Domain))/aliases?pagination=true&limit=50" -AuthHeader $authHeader
      $aliasesAgain = Assert-ForwardEmailOk -Result $aliasesAgain -Operation 'GET aliases after create race'
      $existingAlias = @($aliasesAgain) | Where-Object { ([string]$_.name).ToLowerInvariant() -eq $Alias.ToLowerInvariant() } | Select-Object -First 1
      if (-not $existingAlias) {
        Assert-ForwardEmailOk -Result $createdAlias -Operation 'POST alias' | Out-Null
      }
      else {
        Write-Host "Alias '$Alias' present after race."
      }
    }
    else {
      Write-Host "Created alias '$Alias'."
    }
  }
}
else {
  Write-Host "WhatIf: would ensure alias $Alias@$Domain -> $AliasRecipient"
}

if ($verifyPending -or $pendingDns) {
  Write-Host 'Done (DNS may still be propagating). Exit 0 — re-run to finish verification.'
}
else {
  Write-Host 'Done.'
}
exit 0
