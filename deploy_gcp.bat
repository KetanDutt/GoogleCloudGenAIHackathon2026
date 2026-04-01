@echo off
echo ==================================================
echo Deploying AI Personal Operations Manager to GCP
echo ==================================================
echo.

set PROJECT_ID=your-gcp-project-id
set REGION=us-central1
set SERVICE_NAME=ai-ops-manager-backend

echo Make sure you have the Google Cloud SDK installed and are authenticated.
echo You can authenticate by running: gcloud auth login
echo.
echo Current Project ID: %PROJECT_ID%
echo If this is incorrect, edit this script and change the PROJECT_ID variable.
echo.
pause

echo.
echo [1/3] Setting Google Cloud Project...
gcloud config set project %PROJECT_ID%

echo.
echo [2/3] Enabling required APIs (Cloud Build, Cloud Run, Vertex AI, BigQuery)...
gcloud services enable cloudbuild.googleapis.com run.googleapis.com aiplatform.googleapis.com bigquery.googleapis.com

echo.
echo [3/3] Building and Deploying Backend to Cloud Run...
cd backend
gcloud run deploy %SERVICE_NAME% --source . --region %REGION% --allow-unauthenticated

cd ..
echo.
echo Deployment Complete! Check the Cloud Run URL above for your backend endpoint.
echo Note: You will need to deploy the frontend (e.g., to Vercel, Firebase Hosting, or another Cloud Run instance) separately, and update its API URL to point to this new backend URL.
pause
