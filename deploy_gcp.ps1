$ErrorActionPreference = "Stop"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Deploying AI Personal Operations Manager (Full Stack)" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# ===== CONFIG =====
$PROJECT_ID = "ai-ops-manager"
$REGION = "us-central1"
$BACKEND_SERVICE = "ai-ops-manager-backend"
$FRONTEND_SERVICE = "ai-ops-manager-frontend"

Write-Host "Using Project: $PROJECT_ID"
Read-Host "Press Enter to continue"

# ===== STEP 1 =====
Write-Host "`n[1/5] Setting Google Cloud Project..." -ForegroundColor Yellow
gcloud config set project $PROJECT_ID
if ($LASTEXITCODE -ne 0) { throw "Failed to set project" }

# ===== STEP 2 =====
Write-Host "`n[2/5] Enabling required APIs..." -ForegroundColor Yellow
gcloud services enable cloudbuild.googleapis.com run.googleapis.com aiplatform.googleapis.com bigquery.googleapis.com
if ($LASTEXITCODE -ne 0) { throw "Failed enabling APIs" }

# ===== STEP 3 =====
Write-Host "`n[3/5] Deploying Backend..." -ForegroundColor Yellow
if (-not (Test-Path "backend")) { throw "backend folder not found" }
Push-Location backend
try {
    gcloud run deploy $BACKEND_SERVICE --source . --region $REGION --allow-unauthenticated
    if ($LASTEXITCODE -ne 0) { throw "Backend deployment failed" }
} finally {
    Pop-Location
}

# ===== GET BACKEND URL =====
$BACKEND_URL = gcloud run services describe $BACKEND_SERVICE --region $REGION --format "value(status.url)"
Write-Host "Backend URL: $BACKEND_URL" -ForegroundColor Green

# ===== STEP 4 =====
Write-Host "`n[4/5] Preparing Frontend..." -ForegroundColor Yellow
if (-not (Test-Path "frontend")) { throw "frontend folder not found" }
Push-Location frontend
try {
    "NEXT_PUBLIC_API_URL=$BACKEND_URL" | Out-File -FilePath .env.production -Encoding utf8
    npm install
    if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "Frontend build failed" }
} finally {
    Pop-Location
}

# ===== STEP 5 =====
Write-Host "`n[5/5] Deploying Frontend..." -ForegroundColor Yellow
Push-Location frontend
try {
    gcloud run deploy $FRONTEND_SERVICE --source . --region $REGION --allow-unauthenticated
    if ($LASTEXITCODE -ne 0) { throw "Frontend deployment failed" }
} finally {
    Pop-Location
}

# ===== FINAL OUTPUT =====
$FRONTEND_URL = gcloud run services describe $FRONTEND_SERVICE --region $REGION --format "value(status.url)"

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Backend:  $BACKEND_URL" -ForegroundColor Green
Write-Host "Frontend: $FRONTEND_URL" -ForegroundColor Green
Write-Host ""

Read-Host "Press Enter to exit"