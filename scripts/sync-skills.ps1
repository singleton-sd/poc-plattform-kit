[CmdletBinding()]
param()

Write-Warning 'scripts/sync-skills.ps1 is deprecated. Running pnpm skills:install:pin.'

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  Write-Error 'pnpm is not available on PATH. Install pnpm, then re-run or use: pnpm skills:install:pin'
  exit 1
}

& pnpm skills:install:pin
if (-not $?) {
  exit 1
}
exit $LASTEXITCODE
