@echo off
setlocal enabledelayedexpansion

echo ==================================================
echo Deploying AI Personal Operations Manager (Full Stack)
echo ==================================================
echo.

:: ===== CONFIG =====
set PROJECT_ID=ai-ops-manager
set REGION=us-central1
set BACKEND_SERVICE=ai-ops-manager-backend
set FRONTEND_SERVICE=ai-ops-manager-frontend

echo Using Project: %PROJECT_ID%
pause

:: ===== STEP 1 =====
echo.
echo [1/5] Setting Google Cloud Project...
gcloud config set project %PROJECT_ID%
if errorlevel 1 (
    echo ERROR: Failed to set project
    pause
    exit /b 1
)

:: ===== STEP 2 =====
echo.
echo [2/5] Enabling required APIs...
gcloud services enable cloudbuild.googleapis.com run.googleapis.com aiplatform.googleapis.com bigquery.googleapis.com
if errorlevel 1 (
    echo ERROR: Failed enabling APIs
    pause
    exit /b 1
)

:: ===== STEP 3 =====
echo.
echo [3/5] Deploying Backend...
if not exist "backend" (
    echo ERROR: backend folder not found
    pause
    exit /b 1
)
cd backend

gcloud run deploy %BACKEND_SERVICE% --source . --region %REGION% --allow-unauthenticated
if errorlevel 1 (
    echo ERROR: Backend deployment failed
    pause
    exit /b 1
)
cd ..

:: ===== GET BACKEND URL =====
for /f "tokens=*" %%i in ('gcloud run services describe %BACKEND_SERVICE% --region %REGION% --format "value(status.url)"') do set RAW_BACKEND_URL=%%i
for /f "tokens=1,* delims=/" %%a in ("%RAW_BACKEND_URL:*//=%") do set BACKEND_URL_DOMAIN=%%a
set BACKEND_URL=https://%BACKEND_URL_DOMAIN%
echo Backend URL: %BACKEND_URL%

:: ===== AFTER BACKEND DEPLOYMENT =====
echo.
echo [3.1/5] Setting backend environment variables...

:: Generate a random SECRET_KEY (using PowerShell from batch)
for /f %%i in ('powershell -Command "$chars = 48..57 + 65..90 + 97..122; -join ($chars | Get-Random -Count 32 | ForEach-Object {[char]$_})"') do set SECRET_KEY=%%i

:: Get frontend URL (if not already set)
if "%FRONTEND_URL%"=="" (
    for /f "tokens=*" %%i in ('gcloud run services describe %FRONTEND_SERVICE% --region %REGION% --format "value(status.url)"') do set FRONTEND_URL=%%i
)

gcloud run services update %BACKEND_SERVICE% ^
    --region %REGION% ^
    --set-env-vars SECRET_KEY=%SECRET_KEY%,GOOGLE_CLOUD_PROJECT=%PROJECT_ID%,GOOGLE_CLOUD_LOCATION=%REGION%,BIGQUERY_DATASET=ai_ops_manager,CORS_ORIGINS=%FRONTEND_URL% ^
    --quiet
if errorlevel 1 (
    echo ERROR: Failed to set backend environment variables
    pause
    exit /b 1
)

:: ===== STEP 4 =====
echo.
echo [4/5] Preparing Frontend...
if not exist "frontend" (
    echo ERROR: frontend folder not found
    pause
    exit /b 1
)
cd frontend

echo NEXT_PUBLIC_API_URL=%BACKEND_URL%> .env.production

call npm install
if errorlevel 1 (
    echo ERROR: npm install failed
    pause
    exit /b 1
)

call npm run build
if errorlevel 1 (
    echo ERROR: Frontend build failed
    pause
    exit /b 1
)
cd ..

:: ===== STEP 5 =====
echo.
echo [5/5] Deploying Frontend...
cd frontend

gcloud run deploy %FRONTEND_SERVICE% --source . --region %REGION% --allow-unauthenticated
if errorlevel 1 (
    echo ERROR: Frontend deployment failed
    pause
    exit /b 1
)
cd ..

:: ===== FINAL OUTPUT =====
for /f "tokens=*" %%i in ('gcloud run services describe %FRONTEND_SERVICE% --region %REGION% --format "value(status.url)"') do set FRONTEND_URL=%%i

echo.
echo ==================================================
echo Deployment Complete!
echo ==================================================
echo Backend:  %BACKEND_URL%
echo Frontend: %FRONTEND_URL%
echo.

pause