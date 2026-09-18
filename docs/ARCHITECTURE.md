# Architecture and design decisions

## Request and trust boundaries

1. The browser requests the Next.js UI and `/api/v1/*` on **one origin**.
2. A bounded Next route handler forwards only necessary headers to a fixed, server-only `BACKEND_URL`. It checks mutation origins, rejects unsafe path segments, forwards cookies/CSRF/request IDs, and never acts as an arbitrary URL proxy. Backend URLs can change without rebuilding the browser bundle.
3. FastAPI validates bounded input, authenticates the session, and scopes every record operation by the authenticated **user UUID**, never by a user ID supplied in a request body.
4. Synchronous SQL/SDK work runs in FastAPI's worker thread pool rather than on the event loop. AI calls release the database read transaction before waiting on Google.
5. The database—not a browser cache—decides whether a write succeeded. Failed writes return errors. The frontend caches data per user, cancels reads on sign-out, and invalidates the relevant workspace after writes.

## Why operational data moved out of BigQuery

BigQuery remains part of the project, but it is not an OLTP identity/workspace store. The previous implementation deduplicated tasks by title, could lose deadlines when appending a completed row, used note content as identity, and reported some failed BigQuery mutations as success. BigQuery also does not enforce the uniqueness guarantees needed for account signup.

**Decision:** SQLAlchemy targets SQLite for a single local installation and PostgreSQL for production. Both implement:

- UUID primary keys; normalized unique account emails.
- Foreign keys with ownership and cascading account deletion.
- Typed UTC timestamps and JSON note/assistant payloads.
- Owner/status/due-date and owner/creation indexes.
- Transactions for multi-record proposals.
- Optimistic `version` checks for edits and deletes; stale updates return `409`.
- Alembic schema migrations. Local development migrates on startup; production checks the revision and refuses to auto-create/alter tables.

SQLite uses WAL, foreign keys, a busy timeout, and durable files. It is **not** suitable for multiple Cloud Run instances or ephemeral filesystems. PostgreSQL pools are bounded (5 normal + 5 overflow connections per process); size database capacity against the instance count.

### Optional BigQuery analytics

`backend/scripts/export_analytics.py` creates a **daily aggregate snapshot**, not raw records. It excludes demo accounts and never exports names, emails, hashes, tokens, task titles, note bodies, or chat prompts. The exporter defaults to a dry run. An explicit `--write` uses parameterized BigQuery DML with a byte-billing cap; `--initialize` additionally creates a partitioned analytics table. Keep this job and its IAM identity separate from the user-facing request path.

This is a deliberate change to the original hackathon architecture, not an interchangeable BigQuery CRUD adapter. There is no automatic dual write or raw-data mirror.

## Assistant pipeline

```text
POST /chat (message + stable request UUID)
  → model allowlist + per-user rate limit + bounded concurrency
  → Orchestrator classifies the request
  → one specialist produces typed output
  → shared Pydantic validation
  → persist a pending proposal and execution summary
  → user confirms or discards
POST /chat/{id}/apply
  → atomic pending-state claim
  → create every proposed item
  → store created IDs + commit once
```

- At most **two model calls** for a request: classification and specialization. Planner requests no longer make a separate model call to schedule every task.
- Up to eight total proposed items, bounded prompt/output sizes, an explicit model allowlist, per-call timeouts, no hidden SDK retries, and four concurrent assistant workflows per process.
- The Google Gen AI SDK client is lazy and reused. SDK/import initialization does not query cloud services.
- Model JSON is validated, not executed. The model has no database credentials, arbitrary tools, code execution, external booking, or notification capabilities.
- Cloud failures and malformed outputs return `503`/`502`. They do **not** invent dates or switch to demo mode.
- A request UUID prevents duplicate persisted proposals. A concurrent retry may still consume a second model generation before the database uniqueness check; confirmations cannot create duplicate batches.
- Confirmations expire after 24 hours. Repeating a successful confirmation returns the original created IDs. A failed transaction leaves the proposal pending and creates no partial batch.
- The trace is an **execution summary returned after completion**, not fabricated live progress. No streaming transport is implemented.
- History persists, but model requests are intentionally single-turn. Prior messages and workspace contents are not automatically sent to Vertex AI.

## Demo and disabled modes

Demo behavior is deterministic and labeled throughout the UI. The local classifier recognizes task/plan, note/summary, event/schedule, and reminder keywords. Explicit tasks remain one task; generic plans use a small template. Notes are copied, not represented as genuine AI summaries. Calendar demo parsing supports `today/tomorrow at <time>` only, uses the profile timezone, and discloses a one-hour suggested duration. Unsupported dates yield an informational reply.

`AI_MODE=disabled` keeps manual CRUD usable while assistant requests return an explicit unavailable response. This is useful when cloud budgets or credentials are not ready.

## Frontend design

- React Query replaces the broad global Zustand subscription. Paginated, debounced resource queries are cached by user ID; mutations are not automatically retried.
- Small shared components cover dialogs, record forms, empty/error/loading states, badges, and pagination. Radix handles modal focus traps, Escape, and focus restoration.
- Task/reminder checkboxes provide local optimistic feedback, disable duplicate clicks, and return to server state after failures.
- Calendar month navigation is anchored to day one (fixes January-31 skipping), includes trailing days, and treats event ends as exclusive. Multi-day events appear on overlapping days.
- `datetime-local` uses local wall-clock conversion, not `toISOString().slice(...)`. Invalid/nonexistent DST times are rejected. Ambiguous fall-back hours still need careful review; the UI cannot select a DST fold explicitly.
- Display/input dates use the browser timezone. The profile timezone is for interpreting assistant requests; it is deliberately identified separately.
- No external font request or image-service dependency is required at build time. DM Sans is self-hosted.

## Deliberate limits

This is a private personal workspace, not a team/collaboration service. There are no invitations, roles, sharing, offline queues, real notification delivery, or external calendar integrations. Rate limits and AI concurrency guards are process-local; a multi-instance public deployment needs gateway/distributed enforcement. See [launch gates and priorities](AUDIT_AND_ROADMAP.md).
