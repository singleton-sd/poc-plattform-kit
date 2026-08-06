# ClickUp REST CLI for agents — prefer this over ClickUp MCP (MCP shares a
# strict rate budget and locks the workspace for hours).
#
# Auth: CLICKUP_API_TOKEN from process / User / Machine env (never print it).
# Defaults: workspace 90161394355, ops list 901616287298.
#
# Custom field values use POST /task/{id}/field/{field_id} (not Update Task).
# On Linux/Cloud without PowerShell, use scripts/clickup.sh instead.
#
# Usage:
#   powershell -File scripts/clickup.ps1 me
#   powershell -File scripts/clickup.ps1 list -Status "READY FOR AI"
#   powershell -File scripts/clickup.ps1 get -TaskId 86d3xxxx
#   powershell -File scripts/clickup.ps1 claim -TaskId 86d3xxxx -ClaimToken <session> [-Status "IN PROGRESS"] [-AssignMe]
#   powershell -File scripts/clickup.ps1 status -TaskId 86d3xxxx -Status "READY FOR REVIEW" [-ClearClaim] [-Url https://...]
#   powershell -File scripts/clickup.ps1 comment -TaskId 86d3xxxx -Text "..."
#   powershell -File scripts/clickup.ps1 field -TaskId 86d3xxxx -FieldId <uuid> -Value "..."
#   powershell -File scripts/clickup.ps1 preview -TaskId 86d3xxxx -Url "https://..."
#   powershell -File scripts/clickup.ps1 create -Name "..." [-Status "TO DO"] [-Description "..."] [-Estimate 50000]
#   powershell -File scripts/clickup.ps1 depend -TaskId 86d3xxxx -DependsOn 86d3yyyy

[CmdletBinding()]
param(
  [Parameter(Position = 0, Mandatory = $true)]
  [ValidateSet('me', 'list', 'get', 'claim', 'status', 'comment', 'field', 'preview', 'create', 'depend')]
  [string]$Command,

  [string]$TaskId,
  [string]$Status,
  [string]$ClaimToken,
  [string]$Text,
  [string]$FieldId,
  [string]$Value,
  [string]$Url,
  [string]$Name,
  [string]$Description,
  [string]$DependsOn,
  [string]$Estimate,
  [switch]$ClearClaim,
  [switch]$IncludeClosed,
  [switch]$AssignMe,
  [int]$Page = 0,

  [string]$ListId = '901616287298',
  [string]$TeamId = '90161394355'
)

$ErrorActionPreference = 'Stop'

$script:ClaimFieldId = '50a8d70c-e3a6-4bd7-8e3d-7661eaf6e6c7'
$script:PreviewFieldId = '978d43d5-e404-4262-98a2-0193ade4736d'
$script:EstimateFieldId = 'ab22f8d4-df04-435e-849a-9ca6c23489be'
$script:SpentFieldId = 'be7b08e9-b094-4578-bd0a-49f20af85f3c'

function Get-ClickUpToken {
  $token = $env:CLICKUP_API_TOKEN
  if (-not $token) {
    $token = [Environment]::GetEnvironmentVariable('CLICKUP_API_TOKEN', 'User')
  }
  if (-not $token) {
    $token = [Environment]::GetEnvironmentVariable('CLICKUP_API_TOKEN', 'Machine')
  }
  if (-not $token) {
    throw 'CLICKUP_API_TOKEN not set (process/User/Machine). Set a personal API token and retry.'
  }
  return $token
}

function Invoke-ClickUp {
  param(
    [Parameter(Mandatory)][ValidateSet('Get', 'Post', 'Put', 'Delete')][string]$Method,
    [Parameter(Mandatory)][string]$Path,
    [object]$Body
  )

  $token = Get-ClickUpToken
  $uri = if ($Path.StartsWith('http')) { $Path } else { "https://api.clickup.com/api/v2$Path" }
  $headers = @{ Authorization = $token }

  $params = @{
    Method      = $Method
    Uri         = $uri
    Headers     = $headers
    ErrorAction = 'Stop'
  }
  if ($PSBoundParameters.ContainsKey('Body') -and $null -ne $Body) {
    $params.ContentType = 'application/json'
    $params.Body = ($Body | ConvertTo-Json -Depth 8 -Compress)
  }

  try {
    return Invoke-RestMethod @params
  }
  catch {
    $resp = $_.Exception.Response
    if ($resp -and [int]$resp.StatusCode -eq 429) {
      $retry = $resp.Headers['Retry-After']
      if (-not $retry) { $retry = '(unknown)' }
      throw "ClickUp rate limited (429). Retry-After=$retry. Stop ClickUp calls in this chat; do not spin."
    }
    $msg = $_.ErrorDetails.Message
    if (-not $msg) { $msg = $_.Exception.Message }
    throw "ClickUp $Method $Path failed: $msg"
  }
}

function Get-CustomFieldValue {
  param($Task, [string]$Id)
  $fields = @($Task.custom_fields)
  $f = $fields | Where-Object { $_.id -eq $Id } | Select-Object -First 1
  if (-not $f) { return $null }
  return $f.value
}

function Test-ClaimTokenEmpty {
  param($Value)
  return ($null -eq $Value) -or [string]::IsNullOrWhiteSpace([string]$Value)
}

function Set-ClickUpField {
  param(
    [Parameter(Mandatory)][string]$TaskId,
    [Parameter(Mandatory)][string]$FieldId,
    $Value
  )
  $null = Invoke-ClickUp -Method Post -Path "/task/$TaskId/field/$FieldId" -Body @{
    value = $Value
  }
}

function Write-TaskSummary {
  param($Task)
  $claim = Get-CustomFieldValue -Task $Task -Id $script:ClaimFieldId
  $preview = Get-CustomFieldValue -Task $Task -Id $script:PreviewFieldId
  [pscustomobject]@{
    id          = $Task.id
    name        = $Task.name
    status      = $Task.status.status
    url         = $Task.url
    assignees   = (@($Task.assignees) | ForEach-Object { $_.username }) -join ', '
    claim_token = $claim
    preview_url = $preview
  }
}

function Write-TaskDetail {
  param($Task)
  [pscustomobject]@{
    id            = $Task.id
    name          = $Task.name
    status        = $Task.status.status
    url           = $Task.url
    description   = $Task.description
    markdown_description = $Task.markdown_description
    assignees     = @($Task.assignees | ForEach-Object {
        [pscustomobject]@{ id = $_.id; username = $_.username; email = $_.email }
      })
    custom_fields = @($Task.custom_fields | ForEach-Object {
        [pscustomobject]@{ id = $_.id; name = $_.name; type = $_.type; value = $_.value }
      })
    dependencies  = $Task.dependencies
    linked_tasks  = $Task.linked_tasks
    claim_token   = (Get-CustomFieldValue -Task $Task -Id $script:ClaimFieldId)
    preview_url   = (Get-CustomFieldValue -Task $Task -Id $script:PreviewFieldId)
  }
}

switch ($Command) {
  'me' {
    $r = Invoke-ClickUp -Method Get -Path '/user'
    [pscustomobject]@{
      id       = $r.user.id
      username = $r.user.username
    } | ConvertTo-Json -Compress
  }

  'list' {
    $parts = @("page=$Page")
    if ($IncludeClosed) { $parts += 'include_closed=true' }
    if ($Status) {
      $encoded = [uri]::EscapeDataString($Status)
      $parts += "statuses%5B%5D=$encoded"
    }
    $path = "/list/$ListId/task?$($parts -join '&')"
    $r = Invoke-ClickUp -Method Get -Path $path
    $rows = @($r.tasks) | ForEach-Object { Write-TaskSummary $_ }
    if ($Status -and $Status -match 'READY FOR (AI|REVIEW)') {
      $rows = $rows | Where-Object { Test-ClaimTokenEmpty $_.claim_token }
    }
    $rows | ConvertTo-Json -Depth 4
  }

  'get' {
    if (-not $TaskId) { throw 'get requires -TaskId' }
    $r = Invoke-ClickUp -Method Get -Path "/task/${TaskId}?include_subtasks=false"
    Write-TaskDetail $r | ConvertTo-Json -Depth 8
  }

  'claim' {
    if (-not $TaskId) { throw 'claim requires -TaskId' }
    if (-not $ClaimToken) { throw 'claim requires -ClaimToken (chat/session id)' }

    $before = Invoke-ClickUp -Method Get -Path "/task/$TaskId"
    $existing = Get-CustomFieldValue -Task $before -Id $script:ClaimFieldId
    if (-not (Test-ClaimTokenEmpty $existing) -and "$existing" -ne "$ClaimToken") {
      throw "Claim refused: task $TaskId already claimed by '$existing'. Abort and pick another ticket."
    }

    # Custom fields must use Set Custom Field Value — Update Task ignores them.
    Set-ClickUpField -TaskId $TaskId -FieldId $script:ClaimFieldId -Value $ClaimToken

    $update = @{}
    if ($Status) { $update.status = $Status }
    if ($AssignMe) {
      $me = Invoke-ClickUp -Method Get -Path '/user'
      $update.assignees = @{ add = @([int64]$me.user.id) }
    }
    if ($update.Count -gt 0) {
      $null = Invoke-ClickUp -Method Put -Path "/task/$TaskId" -Body $update
    }

    $verify = Invoke-ClickUp -Method Get -Path "/task/$TaskId"
    $got = Get-CustomFieldValue -Task $verify -Id $script:ClaimFieldId
    if ("$got" -ne "$ClaimToken") {
      throw "Claim race lost: expected Claim Token '$ClaimToken', got '$got'. Abort and pick another ticket."
    }
    Write-TaskSummary $verify | ConvertTo-Json -Depth 4
  }

  'status' {
    if (-not $TaskId) { throw 'status requires -TaskId' }
    if (-not $Status) { throw 'status requires -Status' }

    if ($ClearClaim) {
      Set-ClickUpField -TaskId $TaskId -FieldId $script:ClaimFieldId -Value ''
    }
    if ($Url) {
      Set-ClickUpField -TaskId $TaskId -FieldId $script:PreviewFieldId -Value $Url
    }

    $null = Invoke-ClickUp -Method Put -Path "/task/$TaskId" -Body @{ status = $Status }
    $verify = Invoke-ClickUp -Method Get -Path "/task/$TaskId"
    Write-TaskSummary $verify | ConvertTo-Json -Depth 4
  }

  'comment' {
    if (-not $TaskId) { throw 'comment requires -TaskId' }
    if (-not $Text) { throw 'comment requires -Text' }
    $r = Invoke-ClickUp -Method Post -Path "/task/$TaskId/comment" -Body @{
      comment_text = $Text
    }
    [pscustomobject]@{ id = $r.id; date = $r.date } | ConvertTo-Json -Compress
  }

  'field' {
    if (-not $TaskId) { throw 'field requires -TaskId' }
    if (-not $FieldId) { throw 'field requires -FieldId' }
    Set-ClickUpField -TaskId $TaskId -FieldId $FieldId -Value $Value
    $verify = Invoke-ClickUp -Method Get -Path "/task/$TaskId"
    Write-TaskSummary $verify | ConvertTo-Json -Depth 4
  }

  'preview' {
    if (-not $TaskId) { throw 'preview requires -TaskId' }
    if (-not $Url) { throw 'preview requires -Url' }
    Set-ClickUpField -TaskId $TaskId -FieldId $script:PreviewFieldId -Value $Url
    $verify = Invoke-ClickUp -Method Get -Path "/task/$TaskId"
    Write-TaskSummary $verify | ConvertTo-Json -Depth 4
  }

  'create' {
    if (-not $Name) { throw 'create requires -Name' }
    $body = @{
      name   = $Name
      status = $(if ($Status) { $Status } else { 'TO DO' })
    }
    if ($Description) { $body.description = $Description }
    $r = Invoke-ClickUp -Method Post -Path "/list/$ListId/task" -Body $body
    if ($Estimate) {
      Set-ClickUpField -TaskId $r.id -FieldId $script:EstimateFieldId -Value $Estimate
      $r = Invoke-ClickUp -Method Get -Path "/task/$($r.id)"
    }
    Write-TaskSummary $r | ConvertTo-Json -Depth 4
  }

  'depend' {
    if (-not $TaskId) { throw 'depend requires -TaskId' }
    if (-not $DependsOn) { throw 'depend requires -DependsOn (blocking task id)' }
    $null = Invoke-ClickUp -Method Post -Path "/task/$TaskId/dependency" -Body @{
      depends_on = $DependsOn
    }
    Write-Output "OK: $TaskId waiting_on $DependsOn"
  }
}
