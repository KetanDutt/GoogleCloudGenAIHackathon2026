# Operations runbook

## Health and status

| Endpoint             | Meaning                                                                    | Cost                      |
| -------------------- | -------------------------------------------------------------------------- | ------------------------- |
| `GET /health`        | Process is running                                                         | No database or model call |
| `GET /ready`         | Database responds to a lightweight `SELECT 1`                              | Database only             |
| `GET /api/v1/status` | Configured mode/models/storage + last provider observation in this process | No live Google probe      |

Production startup checks the migration head before serving traffic. A model status of `configured` means exactly that; `last_request_succeeded`/`last_request_failed` are historical, **per-process** observations, not a global service SLA. Health endpoints deliberately do not spend tokens or query BigQuery.

## Logs and metrics

The API emits JSON request records to stdout: `event`, `request_id`, route template (not the query string), method, status, and duration. `X-Request-ID` is forwarded through the frontend for support correlation. Expected model/storage failures log error types, not raw prompts, SQL parameters, credentials, or model responses. Run Uvicorn with `--no-access-log` as the supplied scripts/images do; generic access logs can contain sensitive search queries.

Restrict Cloud Logging access and retention. Do not add request/response body logging. Track at least:

- 5xx rate, readiness failures, p50/p95 latency, database pool saturation.
- 401/403/429 trends (abuse, cookie/CSRF misconfiguration, or exhausted shared-peer limits).
- Assistant failures/latency, per-model usage, project quotas, spend, and instance count.
- Migration/job failures and backup/restore success.

Cloud budgets are alerts, not guaranteed spending caps. Combine project quotas, model allowlists, output limits, gateway controls, and instance limits. Frontend timeout/cancellation does not guarantee a provider stopped billing a request already submitted.

## Retention and cleanup

Expired sessions cannot authenticate even before they are deleted. A CLI reclaims storage; it is **not** scheduled automatically:

```bash
# Read-only plan
.venv/bin/python -m backend.scripts.maintenance
.venv/bin/python -m backend.scripts.maintenance --demo-older-than-hours 24

# Explicitly apply after reviewing counts
.venv/bin/python -m backend.scripts.maintenance --demo-older-than-hours 24 --apply
```

Only expired sessions and optionally old **demo** accounts with no live sessions are candidates. Regular accounts are never age-deleted. Removing a demo account cascades its workspace/history. Production demo creation is disabled; retention still matters for a long-running development/showcase instance.

User content and chat history otherwise remain until the user deletes them or the account. There is no automatic anonymization, archival, or configurable legal-retention engine. Set and disclose an organizational policy before public use.

## Backups and recovery

- **PostgreSQL:** configure automated managed backups/PITR; take consistent `pg_dump` backups with least-privilege access as appropriate. Restore into a separate database and test schema, counts, ownership, and user workflows. Treat all backups as sensitive personal data.
- **SQLite:** for a local backup, use SQLite's `.backup` mechanism or Python's `Connection.backup()` while the service runs; copying only the live `.db` file can miss WAL contents. Alternatively stop the app cleanly before copying the database. Store backups outside Git.
- User JSON exports are a portability aid, not a full database disaster-recovery backup. They omit credentials and may truncate collections over 10,000 rows or an overall 8 MiB byte budget (two downloads per user per minute); v2 JSON re-import is not currently implemented.
- On a security-related restore or promotion from insecure development, revoke old `auth_sessions` deliberately. A full `DELETE FROM auth_sessions;` signs everyone out; only an authorized operator should run it. Do not keep stolen sessions valid because they came from an older backup.

## Optional BigQuery daily aggregates

```bash
# Safe local preview: no Google call
.venv/bin/python -m backend.scripts.export_analytics

# Explicit first-time provisioning/export (billed; needs ADC + appropriate IAM)
.venv/bin/python -m backend.scripts.export_analytics --write --initialize

# Subsequent daily job
.venv/bin/python -m backend.scripts.export_analytics --write
```

Configure `GOOGLE_CLOUD_PROJECT`, `BIGQUERY_LOCATION`, and `BIGQUERY_DATASET`. Default table: `ai_ops_analytics.workspace_daily_metrics`, partitioned by `snapshot_date`, with a required partition filter. Snapshot date is UTC; sequential reruns update that day's row using a parameterized MERGE. Use one scheduled exporter; no distributed locking for concurrent analytics jobs is claimed.

Exported fields are UTC date/time and aggregate counts of non-demo tasks, completed tasks, notes, events, and pending reminders. No personal text, emails, identifiers, or authentication material is exported. The query has `maximum_bytes_billed=100000000`; permissions and limits should also be enforced at the project/dataset. Small-population aggregates can still be sensitive—restrict access.

A Scheduler/Cloud Run job is an operator-managed integration, not background work inside the web request. Cloud provisioning/export has not been live-tested. Do not enable BigQuery in user-request health checks.

## Common incidents

**“Unable to connect” / 502 / 503:** check frontend `BACKEND_URL` from the server's environment, backend readiness, request ID, migration revision, database connectivity/role grants, and provider mode/permissions. Never paste database URLs, session cookies, or private note bodies into a public issue.

**Login works then returns to login in a preview:** check cookie acceptance. Embedded HTTPS previews need the documented Secure/SameSite=None/Partitioned development settings or a top-level tab. Standalone production normally uses Lax. A plain-HTTP non-localhost host cannot use Secure cookies.

**403 after changing password in another tab:** cookies rotate across tabs but the old tab's in-memory CSRF value does not. Reload to restore the new session; do not disable CSRF or silently replay writes.

**409 during edit/delete:** another operation changed or removed the record. Refetch, review the current version, then retry deliberately. Never replace version checking with unconditional overwrite.

**Assistant timed out:** wait and reload history first, then retry with the same request UUID if necessary. No proposal is automatically applied. Check provider costs/quota and keep the default per-call timeout within the 55-second proxy budget.

**Email/password forgotten:** there is no self-service recovery/verified-email flow. Do not email a temporary password or implement an unauthenticated reset shortcut. Use an approved identity-provider/account-recovery process after deployment integration.

**Compromised credentials or exposed backup:** restrict access, rotate affected credentials, revoke sessions, preserve authorized audit evidence, restore safely if needed, and follow [Security](SECURITY.md). Deleting a file from HEAD does not erase its Git history or existing clones.
