# Configuration reference

Backend settings are loaded from environment variables and then `backend/.env`, independent of the shell working directory. Environment variables take precedence. Unknown legacy variables are ignored; no Google service is contacted while loading configuration. Do not commit real `.env` files.

## Backend

| Variable                | Default                                         | Notes                                                                                                                                                                  |
| ----------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ENVIRONMENT`           | `development`                                   | `development`, `test`, or `production`. Cloud Run services must explicitly use production.                                                                             |
| `DATABASE_URL`          | absolute `backend/data/workspace.db` SQLite URL | `sqlite:///...` locally; `postgresql+psycopg://...` in production. Use UTF-8 databases.                                                                                |
| `AI_MODE`               | `demo`                                          | `demo`, `vertex`, or `disabled`. Production rejects demo.                                                                                                              |
| `ALLOW_DEMO_LOGIN`      | `true`                                          | Enables private sample accounts; production requires false.                                                                                                            |
| `GOOGLE_CLOUD_PROJECT`  | empty                                           | Required for Vertex or an actual analytics export.                                                                                                                     |
| `GOOGLE_CLOUD_LOCATION` | `us-central1`                                   | Validate the region against the chosen model. Analytics has a separate location.                                                                                       |
| `DEFAULT_MODEL`         | `gemini-2.5-flash`                              | Must occur in the allowlist. Verify lifecycle/region availability yourself.                                                                                            |
| `ALLOWED_MODELS`        | `gemini-2.5-flash,gemini-2.5-flash-lite`        | Comma-separated allowlist, not automatic discovery. Keep costly models out unless intentionally enabled.                                                               |
| `AI_TIMEOUT_SECONDS`    | `20`                                            | 5–25; applies to each model call. Keep two calls within the proxy's 55-second timeout (20 is recommended).                                                             |
| `SESSION_HOURS`         | `12`                                            | 1–168; absolute expiry, not sliding renewal.                                                                                                                           |
| `COOKIE_SECURE`         | `false`                                         | Production requires true; enables the `__Host-aiops_session` cookie name. Otherwise `aiops_session`.                                                                   |
| `COOKIE_SAMESITE`       | `lax`                                           | `lax`, `strict`, or `none`; none requires Secure.                                                                                                                      |
| `COOKIE_PARTITIONED`    | `false`                                         | Optional CHIPS cookies for embedded HTTPS previews; requires Secure + SameSite=None.                                                                                   |
| `CORS_ORIGINS`          | `http://localhost:3000`                         | Explicit comma-separated origins. Empty is appropriate when all browser traffic uses the same-origin proxy. No wildcard credentials. Production entries must be HTTPS. |
| `AUTH_RATE_LIMIT`       | `20`                                            | Per minute per direct peer and normalized email; process-local safety net. Requests via one frontend can share a peer bucket.                                          |
| `CHAT_RATE_LIMIT`       | `12`                                            | Requests per minute per user, per process.                                                                                                                             |
| `MAX_BODY_BYTES`        | `65536`                                         | Backend mutation body limit, including chunked bodies. The frontend proxy also caps bodies at 64 KiB; raising only this setting will not raise that limit.             |
| `BIGQUERY_DATASET`      | `ai_ops_analytics`                              | Used only by the optional aggregate-export CLI.                                                                                                                        |
| `PORT`                  | launch-command dependent                        | Uvicorn CLI controls the local port; Docker honors Cloud Run's injected `PORT`. Not a Python Settings field.                                                           |

Production also requires the **current Alembic revision**. A missing/wrong database, demo configuration, or insecure cookie setup causes startup failure rather than a fake healthy fallback.

### PostgreSQL examples

```dotenv
# Local development against an already-created PostgreSQL database:
DATABASE_URL=postgresql+psycopg://aiops:LOCAL_ONLY_PASSWORD@localhost:5432/aiops

# Cloud SQL Unix socket (store the entire real value in Secret Manager):
# postgresql+psycopg://APP_USER:URL_ENCODED_PASSWORD@/aiops?host=/cloudsql/PROJECT:REGION:INSTANCE
```

Percent-encode reserved characters in usernames/passwords. Use TLS (`sslmode=verify-full` with a trusted CA where applicable) for external database connections. Never place a database URL in a `NEXT_PUBLIC_*` variable or a frontend build argument.

**`BIGQUERY_LOCATION`** defaults to `US` and is used only by the optional analytics CLI. Match the existing dataset location; this is separate from the Vertex model region.

## Frontend

| Variable                  | Default                         | Purpose                                                                                                                                                      |
| ------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `BACKEND_URL`             | `http://127.0.0.1:8080`         | **Server-only runtime** upstream. In Compose: `http://backend:8080`. In Cloud Run: the backend HTTPS URL. The browser always calls relative `/api/v1` paths. |
| `NEXT_BUILD_DIR`          | `.next`                         | Test infrastructure uses `.next/e2e` to avoid the running preview's build lock. Normally leave unset.                                                        |
| `PORT` / `HOSTNAME`       | `3000` / `0.0.0.0` in the image | Standalone Next server.                                                                                                                                      |
| `NEXT_TELEMETRY_DISABLED` | not set locally                 | Set `1` to disable Next.js telemetry; CI/images already do.                                                                                                  |

Copy `frontend/.env.example` to `frontend/.env.local` for manual local runs. No test-account password, API credential, or browser-facing localhost backend URL is embedded in the bundle.

## Embedded HTTPS previews

A cross-site iframe may reject a normal SameSite=Lax session cookie. For a **development preview served over HTTPS**, start the backend with:

```dotenv
COOKIE_SECURE=true
COOKIE_SAMESITE=none
COOKIE_PARTITIONED=true
```

The proxy preserves `Set-Cookie`, including `Partitioned`. CSRF checks remain enabled. Use a browser supporting partitioned cookies, or open the preview in its own tab. Keep the default Lax policy for standalone deployments unless embedding is an intentional, reviewed requirement. The frontend production CSP defaults to same-origin framing; the development server permits preview embedding.

No browser request should target `localhost:8080` on a remote user's machine. Only the Next server uses its own internal/loopback upstream address.
