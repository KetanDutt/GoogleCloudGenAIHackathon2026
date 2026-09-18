# AI Ops backend

FastAPI application rooted at `backend.main:app`. Run commands from the repository root:

```bash
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements-dev.txt
# Copy backend/.env.example to backend/.env only if missing.
.venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8080 --reload --no-access-log
```

Development uses durable SQLite + Alembic and explicit local demo templates. Production requires PostgreSQL, current migrations, secure cookies, and demo disabled. No model or BigQuery call occurs on import/startup/health checks. Readiness checks the configured database. Set Vertex credentials/settings only when intentionally testing real AI.

- [Configuration](../docs/CONFIGURATION.md)
- [API / OpenAPI](../docs/API.md)
- [Architecture](../docs/ARCHITECTURE.md)
- [Testing](../docs/TESTING.md)
- [Deployment](../docs/DEPLOYMENT.md)
- [Migration and historical credential exposure](../docs/MIGRATION.md)
- [Operations, cleanup, optional BigQuery analytics](../docs/OPERATIONS.md)

The backend Dockerfile must be built with the **repository root** context so it includes `alembic.ini` and migrations. Do not build/deploy the old BigQuery CRUD adapter or restore credential-bearing mock backups.
