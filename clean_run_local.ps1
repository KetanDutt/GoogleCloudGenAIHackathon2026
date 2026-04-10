$ErrorActionPreference = "Stop"

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "   AI Ops Manager - Clean Local Reset & Restart" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

# ----------------------------------------------------------------------
# 1. Confirm BigQuery Project and Dataset
# ----------------------------------------------------------------------
$PROJECT_ID = "ai-ops-manager"          # Update if different
$DATASET = "ai_ops_manager"
$REGION = "us-central1"

Write-Host "Using GCP Project: $PROJECT_ID"
Write-Host "BigQuery Dataset: $DATASET"
$confirm = Read-Host "Is this correct? (y/n)"
if ($confirm -ne 'y') {
    $PROJECT_ID = Read-Host "Enter GCP Project ID"
    $DATASET = Read-Host "Enter BigQuery Dataset name"
}

# ----------------------------------------------------------------------
# 2. Backup Option
# ----------------------------------------------------------------------
$backupChoice = Read-Host "Do you want to backup existing BigQuery data before reset? (y/n)"
$BACKUP_DIR = ".\backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
if ($backupChoice -eq 'y') {
    Write-Host "Backing up tables to $BACKUP_DIR ..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Force -Path $BACKUP_DIR | Out-Null

    $tables = @("tasks", "notes", "events", "reminders", "users")
    foreach ($table in $tables) {
        $outputFile = "$BACKUP_DIR\$table.json"
        bq query --nouse_legacy_sql --format=prettyjson `
            "SELECT * FROM ``$PROJECT_ID.$DATASET.$table``" > $outputFile
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "Failed to backup $table (may not exist)"
        } else {
            Write-Host "  ✓ $table backed up" -ForegroundColor Green
        }
    }
    Write-Host "Backup complete." -ForegroundColor Green
}

# ----------------------------------------------------------------------
# 3. Drop and Recreate Dataset (or Truncate Tables)
# ----------------------------------------------------------------------
Write-Host "`nResetting BigQuery dataset..." -ForegroundColor Yellow
$resetChoice = Read-Host "Drop and recreate entire dataset '$DATASET'? (y/n) - if 'n', tables will be truncated"
if ($resetChoice -eq 'y') {
    bq rm -r -f -d ${PROJECT_ID}:${DATASET}
    bq mk --location=$REGION --dataset ${PROJECT_ID}:${DATASET}
    Write-Host "Dataset recreated." -ForegroundColor Green
} else {
    # Truncate each table (delete all rows)
    $tables = @("tasks", "notes", "events", "reminders", "users")
    foreach ($table in $tables) {
        bq query --nouse_legacy_sql "DELETE FROM ``$PROJECT_ID.$DATASET.$table`` WHERE TRUE"
        Write-Host "  Truncated $table" -ForegroundColor Green
    }
}

# ----------------------------------------------------------------------
# 4. Restore Backup (if any)
# ----------------------------------------------------------------------
if ($backupChoice -eq 'y') {
    $restoreChoice = Read-Host "Restore backed up data? (y/n)"
    if ($restoreChoice -eq 'y') {
        Write-Host "Restoring data from $BACKUP_DIR ..." -ForegroundColor Yellow
        foreach ($table in $tables) {
            $file = "$BACKUP_DIR\$table.json"
            if (Test-Path $file) {
                bq load --source_format=NEWLINE_DELIMITED_JSON "${PROJECT_ID}:${DATASET}.${table}" $file
                Write-Host "  ✓ $table restored" -ForegroundColor Green
            }
        }
    }
}

# ----------------------------------------------------------------------
# 5. Clear Frontend Build Cache and Local Mock DB
# ----------------------------------------------------------------------
Write-Host "`nClearing frontend build cache and local mock database..." -ForegroundColor Yellow
if (Test-Path "frontend\.next") {
    Remove-Item -Recurse -Force "frontend\.next"
    Write-Host "  ✓ .next folder deleted" -ForegroundColor Green
}
if (Test-Path "backend\mock_db.json") {
    Remove-Item -Force "backend\mock_db.json"
    Write-Host "  ✓ backend\mock_db.json deleted" -ForegroundColor Green
}

# ----------------------------------------------------------------------
# 6. Stop any running services (optional)
# ----------------------------------------------------------------------
Write-Host "`nStopping any running Node/Python processes on ports 3000/8080..." -ForegroundColor Yellow
# Kill processes on port 3000 (frontend)
$frontendPid = (Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue).OwningProcess
if ($frontendPid) { Stop-Process -Id $frontendPid -Force }
# Kill processes on port 8080 (backend)
$backendPid = (Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue).OwningProcess
if ($backendPid) { Stop-Process -Id $backendPid -Force }

# ----------------------------------------------------------------------
# 7. Start Services Fresh
# ----------------------------------------------------------------------
Write-Host "`nStarting services..." -ForegroundColor Cyan

# Backend
Write-Host "  [1/2] Starting Backend (port 8080)..." -ForegroundColor Yellow
Push-Location backend
if (-not (Test-Path "venv")) {
    py -m venv venv
}
& .\venv\Scripts\Activate.ps1
pip install -q -r requirements.txt
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$pwd'; .\venv\Scripts\Activate.ps1; uvicorn main:app --reload --port 8080"
Pop-Location

# Frontend
Write-Host "  [2/2] Starting Frontend (port 3000)..." -ForegroundColor Yellow
Push-Location frontend
npm install
npm run build
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$pwd'; npm start"
Pop-Location

Write-Host "`n======================================================" -ForegroundColor Green
Write-Host "   All services started. Access the app at:"
Write-Host "   Frontend: http://localhost:3000"
Write-Host "   Backend:  http://localhost:8080"
Write-Host "======================================================" -ForegroundColor Green
Write-Host ""
Read-Host "Press Enter to exit"
