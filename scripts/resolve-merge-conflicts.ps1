#Requires -Version 5.1
<#
.SYNOPSIS
  Mechanically resolve regenerable merge/rebase conflicts for agents.

.DESCRIPTION
  Run after "git merge origin/main" (preferred) or during a rebase when
  unmerged paths remain. Handles lockfile regen, package.json JSON merges,
  skills (take main unless -SkillsSync), infra/main.json via az bicep build,
  optional docs take-main, and .env.example key union.

  Exit 0 when no unmerged paths remain. Exit 1 when semantic leftovers need
  hand-fix (lists them). Never uses --no-verify.

.PARAMETER SkillsSync
  Re-run pnpm skills:install:pin for skill conflicts instead of taking main.

.PARAMETER ForceKeepFeatureDocs
  Leave AGENTS.md / SETUP.md / docs hubs / infra/README.md for hand-fix
  instead of taking main.

.PARAMETER SkipPnpmInstall
  After taking main lockfile, skip pnpm install (CI/debug only).
#>
[CmdletBinding()]
param(
  [switch]$SkillsSync,
  [switch]$ForceKeepFeatureDocs,
  [switch]$SkipPnpmInstall
)

$ErrorActionPreference = 'Stop'

function Write-Step {
  param([string]$Message)
  Write-Host ''
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Test-GitRev {
  param([string]$Rev)
  git rev-parse -q --verify $Rev 2>$null | Out-Null
  return ($LASTEXITCODE -eq 0)
}

function Get-UnmergedPaths {
  $raw = git diff --name-only --diff-filter=U 2>$null
  if (-not $raw) { return @() }
  $list = @()
  foreach ($line in @($raw)) {
    if ($line -and $line.Trim()) {
      $list += ($line.Trim() -replace '\\', '/')
    }
  }
  return $list
}

function Get-MergeContext {
  $merging = Test-GitRev 'MERGE_HEAD'
  $rebaseMerge = git rev-parse --git-path rebase-merge 2>$null
  $rebaseApply = git rev-parse --git-path rebase-apply 2>$null
  $rebasing = (Test-GitRev 'REBASE_HEAD') -or `
    (Test-Path -LiteralPath $rebaseMerge) -or `
    (Test-Path -LiteralPath $rebaseApply)

  if ($merging -and $rebasing) {
    throw 'Both MERGE_HEAD and rebase state present; abort and retry.'
  }
  if (-not $merging -and -not $rebasing) {
    $left = Get-UnmergedPaths
    if ($left.Count -eq 0) { return $null }
    throw 'Unmerged paths exist but neither MERGE_HEAD nor rebase state was found.'
  }

  # Merging main into feature: main = theirs, feature = ours
  # Rebasing feature onto main: main = ours, feature = theirs
  if ($merging) {
    return @{
      Mode             = 'merge'
      MainCheckout     = '--theirs'
      FeatureCheckout  = '--ours'
    }
  }
  return @{
    Mode             = 'rebase'
    MainCheckout     = '--ours'
    FeatureCheckout  = '--theirs'
  }
}

function Invoke-GitCheckoutSide {
  param(
    [string]$Side,
    [string[]]$Paths
  )
  if ($Paths.Count -eq 0) { return }
  & git checkout $Side -- @Paths
  if ($LASTEXITCODE -ne 0) {
    throw "git checkout $Side failed for: $($Paths -join ', ')"
  }
}

function Invoke-GitAdd {
  param([string[]]$Paths)
  if ($Paths.Count -eq 0) { return }
  & git add -- @Paths
  if ($LASTEXITCODE -ne 0) {
    throw "git add failed for: $($Paths -join ', ')"
  }
}

function Get-StageBlob {
  param(
    [int]$Stage,
    [string]$Path
  )
  $oid = $null
  $lines = git ls-files -u -- $Path
  foreach ($line in @($lines)) {
    if ($line -match ("^\d+\s+([0-9a-f]+)\s+" + $Stage + "\s+")) {
      $oid = $Matches[1]
      break
    }
  }
  if (-not $oid) { return $null }
  return (git cat-file -p $oid)
}

function ConvertTo-StringHashtable {
  param($obj)
  $h = @{}
  if ($null -eq $obj) { return $h }
  foreach ($p in $obj.PSObject.Properties) {
    $h[$p.Name] = [string]$p.Value
  }
  return $h
}

function Merge-JsonMaps {
  param(
    [hashtable]$Base,
    [hashtable]$Ours,
    [hashtable]$Theirs
  )
  $keys = @{}
  foreach ($k in @($Base.Keys)) { $keys[$k] = $true }
  foreach ($k in @($Ours.Keys)) { $keys[$k] = $true }
  foreach ($k in @($Theirs.Keys)) { $keys[$k] = $true }

  $out = [ordered]@{}
  foreach ($k in ($keys.Keys | Sort-Object)) {
    $hasB = $Base.ContainsKey($k)
    $hasO = $Ours.ContainsKey($k)
    $hasT = $Theirs.ContainsKey($k)
    $b = if ($hasB) { $Base[$k] } else { $null }
    $o = if ($hasO) { $Ours[$k] } else { $null }
    $t = if ($hasT) { $Theirs[$k] } else { $null }

    if (-not $hasO -and -not $hasT) { continue }
    if (-not $hasO) { $out[$k] = $t; continue }
    if (-not $hasT) { $out[$k] = $o; continue }
    if ($o -eq $t) { $out[$k] = $o; continue }
    # Both changed: if ours equals base, take theirs; else keep ours (feature)
    if ($hasB -and ($o -eq $b) -and ($t -ne $b)) {
      $out[$k] = $t
    }
    else {
      $out[$k] = $o
    }
  }
  return $out
}

function Merge-PackageJson {
  param(
    [string]$Path,
    [hashtable]$Ctx
  )
  $baseText = Get-StageBlob -Stage 1 -Path $Path
  $oursText = Get-StageBlob -Stage 2 -Path $Path
  $theirsText = Get-StageBlob -Stage 3 -Path $Path
  if (-not $oursText -or -not $theirsText) {
    Write-Warning "package.json missing stage blobs for $Path - leaving unmerged"
    return $false
  }

  try {
    $base = if ($baseText) { $baseText | ConvertFrom-Json } else { [pscustomobject]@{} }
    $ours = $oursText | ConvertFrom-Json
    $theirs = $theirsText | ConvertFrom-Json
  }
  catch {
    Write-Warning "Failed to parse package.json stages for $Path - $($_.Exception.Message)"
    return $false
  }

  # Start from feature side (merge: ours = feature; rebase: theirs = feature)
  if ($Ctx.Mode -eq 'merge') {
    $merged = $oursText | ConvertFrom-Json
  }
  else {
    $merged = $theirsText | ConvertFrom-Json
  }

  $sections = @('dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies', 'scripts')
  foreach ($section in $sections) {
    $b = ConvertTo-StringHashtable $base.$section
    $o = ConvertTo-StringHashtable $ours.$section
    $t = ConvertTo-StringHashtable $theirs.$section
    if ($b.Count -eq 0 -and $o.Count -eq 0 -and $t.Count -eq 0) { continue }
    $map = Merge-JsonMaps -Base $b -Ours $o -Theirs $t
    $props = [ordered]@{}
    foreach ($k in $map.Keys) { $props[$k] = $map[$k] }
    $merged | Add-Member -MemberType NoteProperty -Name $section -Value ([pscustomobject]$props) -Force
  }

  $full = Join-Path (git rev-parse --show-toplevel) $Path
  $json = ($merged | ConvertTo-Json -Depth 100) + "`n"
  [System.IO.File]::WriteAllText($full, $json, [System.Text.UTF8Encoding]::new($false))
  Invoke-GitAdd -Paths @($Path)
  Write-Host "Merged package.json keys: $Path"
  return $true
}

function Merge-EnvExample {
  param([string]$Path)
  $oursText = Get-StageBlob -Stage 2 -Path $Path
  $theirsText = Get-StageBlob -Stage 3 -Path $Path
  if (-not $oursText -or -not $theirsText) {
    Write-Warning '.env.example missing stage blobs - leaving unmerged'
    return $false
  }

  $lines = New-Object System.Collections.Generic.List[string]
  $seenKeys = @{}
  foreach ($block in @($oursText, $theirsText)) {
    foreach ($line in ($block -split "`r?`n")) {
      if ($line -match '^\s*#' -or $line -match '^\s*$') {
        if (-not $lines.Contains($line)) { [void]$lines.Add($line) }
        continue
      }
      if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=') {
        $key = $Matches[1]
        if ($seenKeys.ContainsKey($key)) { continue }
        $seenKeys[$key] = $true
        [void]$lines.Add($line)
      }
      else {
        if (-not $lines.Contains($line)) { [void]$lines.Add($line) }
      }
    }
  }

  $full = Join-Path (git rev-parse --show-toplevel) $Path
  [System.IO.File]::WriteAllText($full, (($lines -join "`n") + "`n"), [System.Text.UTF8Encoding]::new($false))
  Invoke-GitAdd -Paths @($Path)
  Write-Host "Unioned .env.example keys: $Path"
  return $true
}

function Test-IsDocHub {
  param([string]$Path)
  $docs = @(
    'AGENTS.md',
    'SETUP.md',
    'docs/pr-pipelines.md',
    'infra/README.md'
  )
  return ($docs -contains $Path)
}

function Test-IsSkillPath {
  param([string]$Path)
  return (
    ($Path -like '.cursor/skills/*') -or
    ($Path -like '.agents/skills/*') -or
    ($Path -like '.claude/skills/*') -or
    ($Path -like '.grok/skills/*')
  )
}

function Test-IsPackageJson {
  param([string]$Path)
  return ($Path -eq 'package.json') -or ($Path -like '*/package.json')
}

function Test-IsHandFix {
  param([string]$Path)
  if ($Path -eq 'infra/main.bicep') { return $true }
  if ($Path -eq 'apps/api/src/main.ts') { return $true }
  if ($Path -eq 'apps/api/src/app.module.ts') { return $true }
  if ($Path -like '.github/workflows/*') { return $true }
  return $false
}

# --- main ---
$repoRoot = git rev-parse --show-toplevel
if (-not $repoRoot) { throw 'Not inside a git repository.' }
Set-Location $repoRoot

$Ctx = Get-MergeContext
if ($null -eq $Ctx) {
  Write-Host 'No merge/rebase in progress and no unmerged paths. Nothing to do.'
  exit 0
}

$modeMsg = 'Conflict mode: {0} (main={1}, feature={2})' -f $Ctx.Mode, $Ctx.MainCheckout, $Ctx.FeatureCheckout
Write-Step $modeMsg

$unmerged = @(Get-UnmergedPaths)
if ($unmerged.Count -eq 0) {
  Write-Host 'No unmerged paths.'
  exit 0
}

Write-Host ("Unmerged paths ({0}):" -f $unmerged.Count)
foreach ($u in $unmerged) { Write-Host "  - $u" }

$remaining = New-Object System.Collections.Generic.List[string]
$needLockRegen = $false
$needBicepBuild = $false
$skillPaths = New-Object System.Collections.Generic.List[string]
$docPaths = New-Object System.Collections.Generic.List[string]

foreach ($p in $unmerged) {
  if ($p -eq 'pnpm-lock.yaml') {
    $needLockRegen = $true
    continue
  }
  if ($p -eq 'infra/main.json') {
    $needBicepBuild = $true
    continue
  }
  if (Test-IsPackageJson -Path $p) {
    $ok = Merge-PackageJson -Path $p -Ctx $Ctx
    if (-not $ok) { [void]$remaining.Add($p) }
    else { $needLockRegen = $true }
    continue
  }
  if ($p -eq '.env.example') {
    $ok = Merge-EnvExample -Path $p
    if (-not $ok) { [void]$remaining.Add($p) }
    continue
  }
  if (Test-IsSkillPath -Path $p) {
    [void]$skillPaths.Add($p)
    continue
  }
  if ((Test-IsDocHub -Path $p) -and -not $ForceKeepFeatureDocs) {
    [void]$docPaths.Add($p)
    continue
  }
  if (Test-IsHandFix -Path $p) {
    [void]$remaining.Add($p)
    continue
  }
  [void]$remaining.Add($p)
}

if ($skillPaths.Count -gt 0) {
  Write-Step ("Skills conflicts ({0})" -f $skillPaths.Count)
  $skillArr = @($skillPaths)
  if ($SkillsSync) {
    Write-Host 'Re-running pnpm skills:install:pin (-SkillsSync)'
    Invoke-GitCheckoutSide -Side $Ctx.MainCheckout -Paths $skillArr
    & pnpm skills:install:pin
    if ($LASTEXITCODE -ne 0) {
      Write-Warning 'pnpm skills:install:pin failed - skill paths left for hand-fix'
      foreach ($s in $skillArr) { [void]$remaining.Add($s) }
    }
    else {
      Invoke-GitAdd -Paths $skillArr
      git add -- .agents/skills .claude/skills .grok/skills .cursor/skills 2>$null
    }
  }
  else {
    Write-Host 'Taking main for skills (not a skills-install ticket). Use -SkillsSync to re-sync.'
    Invoke-GitCheckoutSide -Side $Ctx.MainCheckout -Paths $skillArr
    Invoke-GitAdd -Paths $skillArr
  }
}

if ($docPaths.Count -gt 0) {
  Write-Step ("Docs hubs -> take main ({0})" -f $docPaths.Count)
  Write-Warning 'Feature edits to these docs (if any) were discarded. Use -ForceKeepFeatureDocs to hand-merge.'
  $docArr = @($docPaths)
  Invoke-GitCheckoutSide -Side $Ctx.MainCheckout -Paths $docArr
  Invoke-GitAdd -Paths $docArr
  foreach ($d in $docArr) { Write-Host "  took main: $d" }
}

if ($needBicepBuild) {
  Write-Step 'infra/main.json'
  $stillPaths = @(Get-UnmergedPaths)
  $bicepUnmerged = ($stillPaths -contains 'infra/main.bicep') -or $remaining.Contains('infra/main.bicep')
  if ($bicepUnmerged) {
    Write-Warning 'infra/main.bicep still conflicted - resolve it, then re-run this script (or az bicep build).'
    if ($stillPaths -contains 'infra/main.json') {
      [void]$remaining.Add('infra/main.json')
    }
  }
  else {
    $az = Get-Command az -ErrorAction SilentlyContinue
    if (-not $az) {
      Write-Warning 'az CLI not found - cannot rebuild infra/main.json'
      [void]$remaining.Add('infra/main.json')
    }
    else {
      Write-Host 'az bicep build -f infra/main.bicep --outfile infra/main.json'
      & az bicep build -f infra/main.bicep --outfile infra/main.json
      if ($LASTEXITCODE -ne 0) {
        Write-Warning 'az bicep build failed'
        [void]$remaining.Add('infra/main.json')
      }
      else {
        Invoke-GitAdd -Paths @('infra/main.json')
        Write-Host 'Regenerated and staged infra/main.json'
      }
    }
  }
}

$stillForLock = @(Get-UnmergedPaths)
if ($needLockRegen -or ($stillForLock -contains 'pnpm-lock.yaml')) {
  Write-Step 'pnpm-lock.yaml'
  if ($stillForLock -contains 'pnpm-lock.yaml') {
    Invoke-GitCheckoutSide -Side $Ctx.MainCheckout -Paths @('pnpm-lock.yaml')
  }
  if ($SkipPnpmInstall) {
    Write-Warning 'Skipped pnpm install (-SkipPnpmInstall); staging main lock as-is'
    Invoke-GitAdd -Paths @('pnpm-lock.yaml')
  }
  else {
    Write-Host 'pnpm install (regenerate lockfile)'
    & pnpm install
    if ($LASTEXITCODE -ne 0) {
      Write-Warning 'pnpm install failed - lockfile may still be conflicted'
      $after = @(Get-UnmergedPaths)
      if ($after -contains 'pnpm-lock.yaml') {
        [void]$remaining.Add('pnpm-lock.yaml')
      }
    }
    else {
      Invoke-GitAdd -Paths @('pnpm-lock.yaml')
      Write-Host 'Regenerated and staged pnpm-lock.yaml'
    }
  }
}

$still = @(Get-UnmergedPaths)
$final = @()
foreach ($r in ($remaining | Select-Object -Unique)) {
  if ($still -contains $r) { $final += $r }
}
foreach ($p in $still) {
  if ($final -notcontains $p) { $final += $p }
}

Write-Step 'Summary'
if ($final.Count -eq 0) {
  Write-Host 'All conflicted paths resolved and staged.' -ForegroundColor Green
  Write-Host 'Next: commit the merge (or git rebase --continue), push, then gh pr checks --watch'
  exit 0
}

Write-Host 'Remaining unmerged paths - hand-fix required:' -ForegroundColor Yellow
foreach ($f in $final) { Write-Host "  - $f" -ForegroundColor Yellow }
Write-Host ''
Write-Host 'Hand-fix tips:'
Write-Host '  infra/main.bicep     keep both resource/module additions; then az bicep build'
Write-Host '  apps/api/src/main.ts / app.module.ts   keep both module/provider registrations'
Write-Host '  .github/workflows/** keep both jobs/steps intentionally'
Write-Host 'Then: git add <paths> and re-run pnpm resolve:conflicts'
exit 1
