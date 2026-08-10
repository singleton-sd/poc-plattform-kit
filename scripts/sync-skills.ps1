# Sync curated agent skills into .cursor/skills for cloud agents.
# Source of truth: local skills repo (also mirrored on GitHub).

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Source = "C:\00Personal\singleton-sd\ai-plattform\skills"
$Dest = Join-Path $Root ".cursor\skills"

$Skills = @(
  @{ Src = "operations\task-driven-development"; Name = "task-driven-development" },
  @{ Src = "operations\task-management"; Name = "task-management" },
  @{ Src = "engineering\backend"; Name = "backend" },
  @{ Src = "engineering\frontend"; Name = "frontend" },
  @{ Src = "engineering\schema-driven-forms"; Name = "schema-driven-forms" },
  @{ Src = "engineering\form-ux"; Name = "form-ux" },
  @{ Src = "engineering\test-generation"; Name = "test-generation" },
  @{ Src = "engineering\code-review"; Name = "code-review" },
  @{ Src = "engineering\fix-bugbot"; Name = "fix-bugbot" },
  @{ Src = "engineering\git-conventions"; Name = "git-conventions" },
  @{ Src = "engineering\repo-init"; Name = "repo-init" },
  @{ Src = "product\backlog-refinement"; Name = "backlog-refinement" },
  @{ Src = "product\idea-to-delivery"; Name = "idea-to-delivery" }
)

if (-not (Test-Path $Source)) {
  Write-Error "Skills source not found: $Source"
}

New-Item -ItemType Directory -Force -Path $Dest | Out-Null

foreach ($s in $Skills) {
  $from = Join-Path $Source $s.Src
  $to = Join-Path $Dest $s.Name
  if (-not (Test-Path $from)) {
    Write-Warning "Missing skill: $from"
    continue
  }
  if (Test-Path $to) { Remove-Item -Recurse -Force $to }
  New-Item -ItemType Directory -Force -Path $to | Out-Null
  Copy-Item -Path (Join-Path $from "*") -Destination $to -Recurse -Force
  Write-Host "Synced $($s.Name)"
}

Write-Host "Done. Skills are under $Dest (commit them for cloud agents)."
