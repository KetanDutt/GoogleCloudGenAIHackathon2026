# Deployment: production configuration, not a launch certification

The code includes production safeguards and deployment scaffolding. **No Google Cloud deployment, real Vertex request, live BigQuery export, container execution, or production load test was performed in this review environment.** Local tests are not a substitute for staging validation and operational ownership.

## Production requirements

- Durable **PostgreSQL**, a verified restore strategy, and the current Alembic schema revision.
- HTTPS, secure cookies, and `ENVIRONMENT=production`.
- `ALLOW_DEMO_LOGIN=false`, `AI_MODE=vertex` (or `disabled`). No ephemeral SQLite fallback.
- Secret-backed database URLs, Application Default Credentials via attached identities, and least-privilege IAM.
- Gateway/distributed abuse controls before multiple publicly accessible instances; in-process limits are only a secondary defense.
- An identity/onboarding decision. The built-in signup does not verify email ownership, offer password recovery, or support MFA. For a public service, integrate a managed identity provider or implement/verify those flows first. Do not describe current signup as verified identity.
- A review of [security/privacy limitations](SECURITY.md) and [launch gates](AUDIT_AND_ROADMAP.md#production-launch-gates).

## Containers

```bash
# Build contexts matter:
docker build -f backend/Dockerfile -t aiops-backend .
docker build -t aiops-frontend ./frontend
```

Both images run as non-root users. Backend runtime dependencies are pinned; the frontend uses a multi-stage standalone build, not the dev server. Local Compose persists SQLite and binds its public port to localhost. It does not configure production HTTPS or managed PostgreSQL.

Container base images are version-family tags rather than immutable digests. Pin tested digests in your release process, scan OS/application packages, and rebuild for security updates. The supplied CI focuses on application checks; it has not validated image execution.

## Prepare Google Cloud resources

Provision these deliberately through your organization's infrastructure workflow. Commands below are examples of resource types, not a claim that they already exist.

1. A billing-enabled project with Cloud Run, Cloud Build, Artifact Registry, Secret Manager, Cloud SQL (if used), and Vertex AI APIs enabled. Enable BigQuery only if using the optional exporter.
2. An existing regional Docker Artifact Registry repository, e.g. `aiops`.
3. A PostgreSQL database encoded as UTF-8. For Cloud SQL, use a private/network policy appropriate to your organization, enable automated backups/PITR, and record its `PROJECT:REGION:INSTANCE` connection name.
4. Separate database roles/URLs for **schema migrations** and **application DML**. Grant the application role usage and SELECT/INSERT/UPDATE/DELETE on the migrated tables, including `alembic_version`; it does not need schema-creation privileges. Configure default privileges for future tables when using a separate schema owner.
5. Secret Manager secrets containing those entire database URLs. Use pinned secret versions, not checked-in passwords.
6. Dedicated service accounts:

| Identity               | Minimum purpose/permissions                                                                                                                                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend runtime        | Vertex AI user for the selected project; accessor on the **application DB** secret; Cloud SQL client if using a Cloud SQL connector/socket. No BigQuery data or project-editor role.                 |
| Migration job          | Accessor on the **schema-owner DB** secret; Cloud SQL client if needed. No Vertex role. Database DDL is controlled by its database user, not just IAM.                                               |
| Frontend runtime       | No Google API/data role; reaches the backend through HTTPS. Do not use a privileged default Compute service account.                                                                                 |
| Build/deploy operator  | Artifact Registry writer, appropriate Cloud Build/Run deployment privileges, and permission to attach only the intended service accounts. Follow organizational controls rather than granting Owner. |
| Optional analytics job | BigQuery job user + editor on the analytics dataset, plus database read access. Dataset creation permissions are needed only for explicit initial provisioning.                                      |

Use Secret Manager bindings at the narrowest appropriate resource. Avoid downloadable service-account keys. Runtime code uses Google Gen AI ADC, not a Gemini API key embedded in the frontend.

A Cloud SQL socket database secret typically has this shape:

```text
postgresql+psycopg://APP_USER:URL_ENCODED_PASSWORD@/aiops?host=/cloudsql/PROJECT:REGION:INSTANCE
```

For an external PostgreSQL endpoint, arrange network reachability and verified TLS; omit `CLOUD_SQL_INSTANCE`. Do not put real secret contents in deployment flags or build arguments.

## Dry-run-first deployment helper

```bash
./deploy_gcp.sh
```

This prints a plan and makes **no cloud calls**. After provisioning/reviewing the above resources, set non-secret identifiers and secret references in your local shell:

```bash
export PROJECT_ID=your-project-id
export REGION=us-central1
export ARTIFACT_REPOSITORY=aiops
export SERVICE_PREFIX=ai-ops
export SERVICE_ACCOUNT=aiops-backend@your-project-id.iam.gserviceaccount.com
export FRONTEND_SERVICE_ACCOUNT=aiops-frontend@your-project-id.iam.gserviceaccount.com
export MIGRATION_SERVICE_ACCOUNT=aiops-migrate@your-project-id.iam.gserviceaccount.com
export DATABASE_SECRET_REF=aiops-application-db-url:1
export MIGRATION_DATABASE_SECRET_REF=aiops-schema-owner-db-url:1
export CLOUD_SQL_INSTANCE=your-project-id:us-central1:your-instance
export MODEL_ID=gemini-2.5-flash  # first verify availability, lifecycle, price, and quota
./deploy_gcp.sh --execute
```

On Windows, `deploy_gcp.ps1` prints the same plan; `-Execute` delegates to the shared Bash implementation (Git Bash or WSL required).

The helper:

1. Confirms the Artifact Registry repository exists; builds/uploads two uniquely tagged images using `cloudbuild.yaml`.
2. Deploys/executes one Alembic migration job before serving the new backend. The initial migration creates **no account** and does not reuse old authentication data.
3. Deploys the backend with production validation, demo disabled, Secure cookies, an explicit single-model allowlist, up to three instances, 16 requests/instance, and 1 GiB memory.
4. Discovers its HTTPS URL and deploys the frontend with **runtime-only** `BACKEND_URL`, a separate unprivileged identity, and up to three instances.

It does not create databases, secrets, IAM grants, Cloud Armor policies, budgets, backups, custom domains, or identity-provider integrations. It does not verify model availability. It uses explicitly selected project/region arguments and does not change your global gcloud project.

### Ingress and authentication caveat

The baseline helper makes both Cloud Run services publicly reachable (`--allow-unauthenticated`). Workspace APIs still require the application's cookie/CSRF authorization; “public ingress” is not public access to records. Public signup/login/status/health remain exposed.

For a hardened public service, use an external HTTPS load balancer/API gateway with abuse controls and ingress restrictions, including coverage of the **backend service URL** so callers cannot bypass the frontend/gateway. If making the backend IAM-private, also implement service-to-service ID-token authentication in the Next proxy; the current proxy does **not** fetch/forward a Cloud Run identity token. Simply removing public invoker access will break it.

The backend does not trust arbitrary browser-supplied forwarded IP headers for rate limiting. Consequently, many users behind the Next proxy may share an auth bucket. Set policy at a trusted gateway rather than raising in-process limits and calling it distributed protection.

### Migrations and permissions

Run migrations once using the schema-owner role; application replicas only check the revision. Test `alembic check` and a staging upgrade before production. Grant the application DB role access to the resulting tables before first startup. No schema down-migration should run automatically during rollback.

The runtime detects Cloud Run's `K_SERVICE` and refuses development mode. This protects against accidentally deploying a local, demo-enabled SQLite instance.

## Release smoke checklist

- `/health` returns 200; `/ready` reaches the database and returns 200. Kill/revoke DB connectivity in staging and verify readiness reports 503 without leaking credentials.
- Unauthenticated record APIs return 401; foreign-owner IDs return 404; invalid/missing CSRF returns 403.
- Register/login with an authorized test account under HTTPS, verify `__Host-` + Secure + HttpOnly cookie attributes, and test logout/revocation.
- Create/edit/delete each resource; test a version conflict from two tabs.
- Send one controlled Vertex prompt, verify a real model response, confirm it once/twice, and check there are no duplicates. Observe billing, latency, model quota, and log redaction.
- Force an AI/storage failure and verify no fake demo response, false success, or partial writes.
- Export/delete the test account; confirm a database backup can be restored into an isolated environment.
- Verify allowed origins, security headers, clickjacking/CSP policy, custom-domain HTTPS/HSTS, gateway throttling, alert destinations, and dashboard mobile/keyboard behavior.
- Load-test expected concurrency and size PostgreSQL connections: up to 10 per backend process, plus migration/operator jobs. Ensure cost/instance limits match the budget.

## Rollback

Keep the previous immutable image tag/revision and schema compatibility plan. Move traffic back to the previous **compatible** Cloud Run revision rather than blindly reversing migrations. A down-migration can delete data. Back up first and perform destructive schema rollback only through an approved recovery procedure. Never run the old removed `clean_run_local.ps1` from repository history against a live cloud project.
