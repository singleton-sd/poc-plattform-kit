# Ensures the ops list has a short-text custom field named "Claim Token".
# Requires CLICKUP_API_TOKEN (personal API token) in the environment.
# Usage: powershell -File scripts/ensure-claim-token-field.ps1

$ErrorActionPreference = 'Stop'

$listId = '901616287298'
$fieldName = 'Claim Token'
$token = $env:CLICKUP_API_TOKEN

if (-not $token) {
  Write-Error 'Set CLICKUP_API_TOKEN to a ClickUp personal API token, then re-run.'
}

$headers = @{
  Authorization = $token
  'Content-Type' = 'application/json'
}

$existing = Invoke-RestMethod `
  -Method Get `
  -Uri "https://api.clickup.com/api/v2/list/$listId/field" `
  -Headers $headers

$match = @($existing.fields) | Where-Object { $_.name -eq $fieldName } | Select-Object -First 1
if ($match) {
  Write-Output "Claim Token field already exists: $($match.id)"
  exit 0
}

$body = @{
  name = $fieldName
  type = 'short_text'
  type_config = @{}
} | ConvertTo-Json -Compress

$created = Invoke-RestMethod `
  -Method Post `
  -Uri "https://api.clickup.com/api/v2/list/$listId/field" `
  -Headers $headers `
  -Body $body

$fieldId = $created.id
if (-not $fieldId -and $created.field) {
  $fieldId = $created.field.id
}

Write-Output "Created Claim Token field: $fieldId"
Write-Output "Paste this UUID into AGENTS.md under ClickUp custom fields."
