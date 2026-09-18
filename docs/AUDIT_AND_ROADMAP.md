# Review findings, implemented improvements, and remaining work

Review date: **2026-09-18**. This is a substantial v2 refactor, not an in-place compatible patch to the original schema. The original hackathon presentation/video and project license were preserved.

## Findings addressed

| Area                    | Original risk/problem                                                                                                         | Implemented outcome                                                                                                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Repository hygiene      | Tracked mock users/backups, password-hash material, runtime logs and build/environment artifacts                              | Removed unnecessary/sensitive runtime files from HEAD; expanded ignores; documented rotation and the fact that history remains exposed                                         |
| Operational storage     | BigQuery used for user/task CRUD; unenforced uniqueness, title/content used as identity, append-only duplicates               | Transactional SQLAlchemy models with UUIDs, unique emails, FKs, scoped queries, indexes, and Alembic; BigQuery retained as optional aggregate analytics                        |
| Correctness             | Completing a task could lose its deadline; notes/tasks with identical text could interfere; write failures could be swallowed | Partial versioned updates, stable IDs, scoped deletes, explicit errors, regression tests, atomic proposal saves                                                                |
| Authentication          | Browser-localStorage bearer tokens, shared demo assumptions, missing revocation/recovery controls                             | HttpOnly opaque sessions, Argon2id, CSRF/origin checks, private demo accounts, revocable logout, password change and session rotation; unsupported recovery remains explicit   |
| Input/API shape         | Weak date/resource validation, inconsistent routes/responses, no bounded listing/optimistic conflict contract                 | `/api/v1`, typed contracts, timezone-aware timestamps, bounded requests/pagination/search, 409 version conflicts, structured/redacted errors, generated OpenAPI                |
| Assistant               | Unreliable output parsing, extra per-task model calls, unbounded/fallback behavior, writes without clear review               | Google Gen AI SDK, allowlisted validated schemas, at most classifier + one specialist, bounded concurrency/timeouts, no hidden fallback, persisted review/confirm/discard flow |
| User trust              | Model “connection” inferred from configuration, fabricated live workflow progress, reminders/calendar overstated              | Explicit demo/Vertex/disabled modes, cheap honest status, completed execution summaries, local-only event/reminder wording, no false delivery/streaming claims                 |
| Frontend connectivity   | Browser-facing localhost/cross-origin configuration risk                                                                      | Fixed server-only runtime proxy with cookie/CSRF forwarding; browser always uses same-origin relative URLs                                                                     |
| Privacy/cache lifecycle | Broad global subscriptions/caches and stale private data risks                                                                | User-scoped query keys, cancellation/clear on auth changes, 401 recovery, no client-side credential persistence                                                                |
| Missing product flows   | Limited/manual CRUD, incomplete settings, persistence and error handling                                                      | Search/filter/pagination, complete/reopen/edit/delete, notebook/calendar/reminders, persistent assistant history, account preferences/password/export/deletion                 |
| Dates/calendar          | Month-end navigation, timezone conversion, overnight boundary errors                                                          | Anchored month grids, local datetime round trips, DST gap validation, preserved sub-minute timestamps on unchanged edits, exclusive-end overlap handling                       |
| UI/accessibility        | Inconsistent screens, weak responsive/error states, poor contrast/keyboard flows                                              | Cohesive light/dark theme, self-hosted font, responsive shell/drawer, focus-managed dialogs, visible errors/retries, tested contrast, reduced-motion support                   |
| Operations              | Unsafe reset/deploy scripts, missing migrations/test harness                                                                  | Non-destructive launchers; dry-run cloud plan; non-root standalone images; CI; PostgreSQL migrations; backup/retention/import/analytics tooling and documentation              |
| Resource use            | Potential giant export materialization and unnecessary model costs                                                            | Driver-batched, 8 MiB/10,000-row-bounded exports, two exports/minute; bounded queries; release DB connections while waiting for models; no paid health probes                  |

## New/expanded features

- Private seeded demo workspaces without fixed shared account credentials.
- Reviewable, persistent assistant proposals with idempotent confirmation and atomic multi-item saves.
- Full manual record lifecycle, literal search, task filters, selected-day calendar agenda, in-app reminders.
- Keyboard task/note search, mobile navigation, theme preference, optional browser dictation.
- Account preference/password management, credential-free export, permanent deletion.
- Explicit unavailable/error/empty/loading states and safe mutation rollback feedback.
- Dry-run legacy-data import, expired-session/demo cleanup, and aggregate-only BigQuery export.

## Verification summary

The [testing report](TESTING.md) records commands/results. Backend tests run against both SQLite and a real local PostgreSQL server, including migration round trips, isolation, concurrent confirmation, rollback, and security cases. Frontend unit/browser tests exercise both desktop and mobile layouts, with axe checks in light/dark modes. The production Next build is checked locally.

**Not validated by those results:** real cloud credentials/models, live BigQuery jobs, container startup, Cloud Run deployment, Windows PowerShell execution, distributed abuse controls, production load, real microphone/vendor behavior, or full assistive-technology/WCAG conformance.

## Production launch gates

These are **remaining work/decisions**, not completed features:

1. **Rotate exposed legacy authentication material** and decide on coordinated Git-history cleanup. Do not reuse v1 hashes or bearer sessions.
2. **Complete identity onboarding/recovery:** verified email, secure reset, MFA/SSO as appropriate, or a managed identity provider. Restrict initial use to a trusted/approved audience until this is resolved.
3. **Provision and validate real infrastructure:** PostgreSQL roles/backups/PITR, Secret Manager, service identities, model access/region/lifecycle/quota, HTTPS, and the chosen ingress policy. Scan/pin built image digests; test containers.
4. **Add gateway/distributed abuse and spend controls** that cannot be bypassed through the public backend URL. Set alerts and operational ownership; tune instance/thread/DB capacity through load tests.
5. **Perform staging cloud/failure/restore tests**, including timed-out requests, model rejection, credential expiry, concurrency, and rollback compatibility. A successful local demo is not a passed cloud integration test.
6. **Review privacy and security for the deployment:** provider data handling/residency, backup/log retention, CSP nonces/HSTS, audit needs, access reviews, and a private vulnerability-response channel.

Until those gates are satisfied, this should be described as a **production-oriented foundation / controlled beta**, not an unqualified production-ready public service.

## Prioritized follow-ups

### P1 — reliability and scale

- Durable queued generation with request-level reservation/locking: avoid duplicate billed model generation during concurrent retries, and support recovery across worker restarts.
- A transactional outbox + scheduler/delivery provider **if real reminders are promised**; delivery consent, retries, deduplication, timezones, and observability come first.
- PostgreSQL full-text/trigram indexing and cursor pagination for large workspaces; add global event/reminder search if needed. Current keyboard search covers tasks and notes.
- Paginated/streaming export jobs and general v2 import for large-account portability; current exports are intentionally bounded and can be truncated.
- Token-budget/usage reporting and gateway-controlled per-user quotas. Status remains per process, not globally aggregated monitoring.

### P2 — product depth

- Google Calendar OAuth sync, with explicit permissions, reconciliation, and conflict handling; current events are local only.
- User-controlled conversation context and model-supported tool grounding, with data-minimization and prompt-injection review; current requests are independent.
- Team spaces/sharing/RBAC, accessibility assistive-device testing, locale formatting options, and explicit DST-fold selection.
- Nonce-based CSP; image/action SHA pinning in the release pipeline; upgrade the ESLint/React tooling combination once compatible.

These suggestions deliberately avoid adding unused heavyweight infrastructure to a small hackathon application before there is an operating need.
