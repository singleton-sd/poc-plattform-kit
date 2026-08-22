[CmdletBinding()]
param()

Write-Warning 'scripts/sync-skills.ps1 is deprecated. Running pnpm skills:install:pin.'
& pnpm skills:install:pin
exit $LASTEXITCODE
