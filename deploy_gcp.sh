#!/usr/bin/env bash
# Review docs/DEPLOYMENT.md first. Dry run by default; --execute explicitly incurs cloud costs.
set -euo pipefail
cd "$(dirname "$0")"
if [[ $# -gt 1 ]]; then echo "Use --execute alone, or no argument for the safe plan." >&2; exit 64; fi
if [[ "${1:-}" != "--execute" ]]; then
  cat <<'PLAN'
Deployment plan (nothing executed):
  1. Build non-root backend/frontend images in an EXISTING Artifact Registry repository.
  2. Deploy and run a one-shot Alembic migration job against your EXISTING PostgreSQL database.
  3. Deploy the production backend (demo disabled, secure cookies, shared database).
  4. Deploy the frontend with a server-only BACKEND_URL.

Required environment: PROJECT_ID, SERVICE_ACCOUNT, FRONTEND_SERVICE_ACCOUNT, MIGRATION_SERVICE_ACCOUNT,
  DATABASE_SECRET_REF and MIGRATION_DATABASE_SECRET_REF (existing name:version references).
Optional: REGION, ARTIFACT_REPOSITORY, SERVICE_PREFIX, CLOUD_SQL_INSTANCE, MODEL_ID.
No databases, credentials, IAM grants, or secrets are created automatically.
Public Cloud Run ingress is used; application authentication remains required on workspace APIs.
Read docs/DEPLOYMENT.md for TLS, identity, rate limiting, IAM, rollback, and launch gates.
Run ./deploy_gcp.sh --execute ONLY after reviewing the plan and configuring the environment.
PLAN
  exit 0
fi
: "${PROJECT_ID:?Set PROJECT_ID}"
: "${SERVICE_ACCOUNT:?Set a least-privilege backend SERVICE_ACCOUNT email}"
: "${FRONTEND_SERVICE_ACCOUNT:?Set a dedicated frontend service account with no Google API roles}"
: "${MIGRATION_SERVICE_ACCOUNT:?Set a dedicated migration service account}"
: "${MIGRATION_DATABASE_SECRET_REF:?Set the schema-owner database secret name:version}"
: "${DATABASE_SECRET_REF:?Set an existing Secret Manager name:version (not a database password)}"
REGION="${REGION:-us-central1}"
ARTIFACT_REPOSITORY="${ARTIFACT_REPOSITORY:-aiops}"
SERVICE_PREFIX="${SERVICE_PREFIX:-ai-ops}"
MODEL_ID="${MODEL_ID:-gemini-2.5-flash}"
TAG="$(git rev-parse --short HEAD)-$(date -u +%Y%m%d%H%M%S)"
command -v gcloud >/dev/null || { echo 'Install and configure gcloud first.' >&2; exit 1; }
# Explicit --project avoids silently changing the operator's active gcloud project.
gcloud artifacts repositories describe "$ARTIFACT_REPOSITORY" --location="$REGION" --project="$PROJECT_ID" >/dev/null
gcloud builds submit . --config=cloudbuild.yaml --project="$PROJECT_ID" \
  --substitutions="_REGION=$REGION,_REPOSITORY=$ARTIFACT_REPOSITORY,_TAG=$TAG"
IMAGE_ROOT="$REGION-docker.pkg.dev/$PROJECT_ID/$ARTIFACT_REPOSITORY"
SQL_ARGS=(--clear-cloudsql-instances)
if [[ -n "${CLOUD_SQL_INSTANCE:-}" ]]; then SQL_ARGS+=(--set-cloudsql-instances="$CLOUD_SQL_INSTANCE"); fi
BASE_ENV="ENVIRONMENT=production,ALLOW_DEMO_LOGIN=false,COOKIE_SECURE=true,CORS_ORIGINS=,GOOGLE_CLOUD_PROJECT=$PROJECT_ID,GOOGLE_CLOUD_LOCATION=$REGION"
gcloud run jobs deploy "$SERVICE_PREFIX-migrate" --project="$PROJECT_ID" --region="$REGION" \
  --image="$IMAGE_ROOT/backend:$TAG" --service-account="$MIGRATION_SERVICE_ACCOUNT" \
  --set-secrets="DATABASE_URL=$MIGRATION_DATABASE_SECRET_REF" --set-env-vars="$BASE_ENV,AI_MODE=disabled" \
  --command=alembic --args=upgrade,head --tasks=1 --max-retries=0 --task-timeout=300s "${SQL_ARGS[@]}"
gcloud run jobs execute "$SERVICE_PREFIX-migrate" --project="$PROJECT_ID" --region="$REGION" --wait
gcloud run deploy "$SERVICE_PREFIX-backend" --project="$PROJECT_ID" --region="$REGION" \
  --image="$IMAGE_ROOT/backend:$TAG" --service-account="$SERVICE_ACCOUNT" \
  --allow-unauthenticated --port=8080 --memory=1Gi --cpu=1 --concurrency=16 --max-instances=3 --timeout=60s \
  --set-secrets="DATABASE_URL=$DATABASE_SECRET_REF" \
  --set-env-vars="$BASE_ENV,AI_MODE=vertex,DEFAULT_MODEL=$MODEL_ID,ALLOWED_MODELS=$MODEL_ID" \
  "${SQL_ARGS[@]}"
BACKEND_URL="$(gcloud run services describe "$SERVICE_PREFIX-backend" --project="$PROJECT_ID" --region="$REGION" --format='value(status.url)')"
gcloud run deploy "$SERVICE_PREFIX-frontend" --project="$PROJECT_ID" --region="$REGION" \
  --image="$IMAGE_ROOT/frontend:$TAG" --service-account="$FRONTEND_SERVICE_ACCOUNT" --allow-unauthenticated --port=3000 --memory=512Mi --cpu=1 \
  --max-instances=3 --timeout=60s --set-env-vars="BACKEND_URL=$BACKEND_URL,HOSTNAME=0.0.0.0"
gcloud run services describe "$SERVICE_PREFIX-frontend" --project="$PROJECT_ID" --region="$REGION" --format='value(status.url)'
echo 'Deployment commands finished. Run the staging smoke tests and production checklist before announcing availability.'
