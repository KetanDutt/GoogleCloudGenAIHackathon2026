# Non-destructive local setup for PowerShell. No cloud deployment/reset commands. The app honors your existing configuration.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
python -c "import sys; assert sys.version_info >= (3, 11), 'Python 3.11+ is required'"
if ($LASTEXITCODE -ne 0) { throw "Python 3.11+ is required" }
if (-not (Test-Path ".venv")) { python -m venv .venv }
if (-not (Test-Path "backend/.env")) { Copy-Item backend/.env.example backend/.env }
if (-not (Test-Path "frontend/.env.local")) { Copy-Item frontend/.env.example frontend/.env.local }
& .\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
if ($LASTEXITCODE -ne 0) { throw "Backend dependency installation failed" }
Push-Location frontend
try {
    npm ci
    if ($LASTEXITCODE -ne 0) { throw "Frontend dependency installation failed" }
} finally { Pop-Location }
$backend = Start-Process -PassThru -NoNewWindow -FilePath "$PSScriptRoot\.venv\Scripts\python.exe" -ArgumentList "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8080", "--no-access-log"
try {
    Write-Host "Workspace: http://localhost:3000 — Ctrl+C stops this launcher. Data is kept."
    Push-Location frontend
    try { node node_modules/next/dist/bin/next dev --hostname 0.0.0.0 --port 3000 }
    finally { Pop-Location }
} finally {
    if (-not $backend.HasExited) { Stop-Process -Id $backend.Id }
}
