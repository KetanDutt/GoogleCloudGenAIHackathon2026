# One shared deployment implementation avoids divergent Windows/cloud settings.
param([switch]$Execute)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
if (-not (Get-Command bash -ErrorAction SilentlyContinue)) {
    throw "Install Git Bash or use WSL, then follow docs/DEPLOYMENT.md. Nothing has been deployed."
}
if ($Execute) { bash ./deploy_gcp.sh --execute } else { bash ./deploy_gcp.sh }
if ($LASTEXITCODE -ne 0) { throw "Deployment command failed. Inspect the output before retrying." }
