# Testing and verification report

Review environment: Linux, Python 3.11.2, Node.js 22.22.3; verification date **2026-09-18**. Configured CI uses Python 3.12, Node 22, and a PostgreSQL 17 service. GitHub CI was not run remotely during the local review; consult the pull request checks for the current CI results.

## Commands

```bash
# Backend: isolated SQLite by default
.venv/bin/pytest --cov=backend --cov-report=term-missing
.venv/bin/ruff check backend
.venv/bin/ruff format --check backend
.venv/bin/pip-audit -r backend/requirements.txt

# Optional PostgreSQL regression run — THIS DATABASE IS ERASED BY TEST FIXTURES
TEST_DATABASE_URL='postgresql+psycopg://USER:LOCAL_PASSWORD@localhost/aiops_test' .venv/bin/pytest

# Frontend
cd frontend
npm ci
npm run lint
npm run typecheck
npm test
npm run format:check
NEXT_TELEMETRY_DISABLED=1 npm run build
npm audit
npx playwright install --with-deps chromium
npm run test:e2e
```

Only use a disposable database whose name includes `aiops_test` for `TEST_DATABASE_URL`; tests drop/recreate its schema. Use UTF-8 encoding. No real model generation or BigQuery job is made by the tests.

## Coverage and behaviors

### Backend

- Registration/email normalization/password bounds, equal-behavior failed logins, duplicate-account conflicts.
- Cookie/session structure, CSRF and origin rejection, owner isolation, session expiry/revocation, password rotation, account-delete cascades, private demos, export content and limits.
- CRUD for all record types, duplicate-title safety, optimistic conflicts, preserved/cleared due dates, invalid/naive event times, literal search and filters, pagination, scoped dashboard counts.
- All four demo agents, explicit one-task planning, no guessed ambiguous dates, proposal persistence/idempotency, apply/discard/history behavior, expiry, atomic rollback, concurrent confirmation.
- Mocked valid/malformed/unavailable Vertex responses, model allowlist, two-call budget, bounded concurrency/rate limiting, no paid health checks.
- Production configuration validation, sanitized storage/input errors, body/chunk limits, readiness, bounded limiter memory.
- SQLite **and PostgreSQL** Alembic upgrade/check/downgrade/upgrade checks.
- Dry-run/scoped/idempotent legacy imports without hashes; maintenance protections; non-demo analytics payload privacy and identifier validation; secure preview cookie attributes; generated OpenAPI auth/error documentation.

Coverage includes operator scripts. Lower-covered areas are mostly CLI argument/main paths, external BigQuery client setup, and real SDK initialization; overall coverage is not a claim that those external systems were tested.

### Frontend unit tests

API cookie/CSRF/request/error/abort handling; server-proxy origin/path/body/timeout guards and app-cookie-only forwarding; numeric validation paths; timezone round trips; nonexistent dates/DST gaps; preserving unchanged seconds/offsets; month-end navigation; six-week grids; overnight/exclusive-end event matching.

### Browser tests

Playwright runs the same scenarios on a **1440px desktop** and **iPhone-sized mobile Chromium** viewport:

- Private demo and responsive/keyboard navigation, no horizontal document overflow.
- Task create/complete/reopen/edit/delete with retained dates.
- Note creation, search, edit, and deletion.
- Event time validation and reminder completion/reopening.
- Assistant preview versus confirmed saves, reload persistence, and repeated-confirmation safety.
- Read failures/retry, write failure rollback, and expired-session removal of private screens.
- Signup/preferences/avatar persistence, data export, and permanent account deletion.
- Keyboard workspace search and filtered navigation.
- axe WCAG 2 A/AA + 2.1 AA checks on login/dashboard/dialog and primary pages in light/dark mode; dialog focus/Escape behavior.

Automated axe results do not prove full WCAG conformance. Real screen-reader, zoom, high-contrast, touch-device, Safari/Firefox, and microphone tests remain necessary. Mobile Chromium emulation is not a physical iPhone/Safari test.

## Sandbox-specific test tooling

The standard Playwright CDN and Debian package mirrors were unreachable in this sandbox. A Chromium 153 binary and its bundled NSS libraries were obtained through an **ignored** npm test-tools installation (`@sparticuz/chromium`). Tests used the normal Playwright launch flags, not disabled browser-security flags. `PLAYWRIGHT_EXECUTABLE_PATH`/`LD_LIBRARY_PATH` selected that binary. A real PostgreSQL 18.4 binary from an ignored embedded-Postgres package ran on a Unix socket. These packages are test environment workarounds, not application dependencies or committed artifacts.

The ordinary project path remains `npx playwright install --with-deps chromium` and a normal disposable PostgreSQL instance. CI installs those normally. No system mirror trust settings, package TLS checks, or application security controls were disabled to make tests pass.

## Verified results

Commands, source tests, and the declared unverified boundaries above take precedence over marketing claims.

| Check                           | Result                                                                                                                                                                      |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SQLite backend suite            | **94 passed**; 90% statement coverage including operator scripts                                                                                                            |
| PostgreSQL backend suite        | **94 passed** against a real local PostgreSQL 18.4 instance                                                                                                                 |
| Alembic                         | Upgrade, schema-drift check, downgrade, and re-upgrade passed on both databases                                                                                             |
| Production-config backend smoke | PostgreSQL migration-head startup, disabled docs/demo routes, secure HTTPS session contract, task CRUD, export, and account deletion passed via TestClient                  |
| Frontend unit tests             | **22 passed** across dates, API client, and server proxy                                                                                                                    |
| Playwright desktop/mobile       | **20 passed** (10 scenarios on each viewport), including light/dark axe checks; 2.2 minutes in the final full run                                                           |
| Clean install / build           | Ordinary `npm ci` and optimized Next production build passed; all 12 listed app routes generated/compiled                                                                   |
| Standalone frontend smoke       | Built standalone server, CSS assets, production CSP, cookie login, runtime proxy, and seeded dashboard passed in Chromium                                                   |
| Preview smoke                   | Desktop/mobile/dark screenshots inspected; no page errors; cross-site iframe login on separate loopback hosts passed with Secure/HttpOnly/SameSite=None/Partitioned cookies |
| Static quality                  | Ruff, Python formatting, ESLint, TypeScript, Prettier, shell syntax, Markdown file links, and `git diff --check` passed                                                     |
| Dependency advisories           | `npm audit`: **0 vulnerabilities**; runtime `pip-audit`: **no known vulnerabilities** at the time of review; `pip check` passed                                             |
| Operator tools                  | Maintenance/analytics dry runs and deployment plan executed without writes/cloud calls; legacy-import behavior and parameterized BigQuery submission tested locally/mocked  |
| Repository scan                 | Focused current-tree scan found no private-key blocks, bcrypt credential strings, or Google API-key patterns; this is **not** a full history/secret-scanner audit           |

Screenshots show fabricated private demo data: [desktop](assets/workspace-desktop.webp), [mobile](assets/workspace-mobile.webp). Smoke scripts/test tooling and database artifacts remain ignored, not application dependencies.

The BigQuery SDK submission test uses a mock client. The production-config backend smoke uses local PostgreSQL + a simulated HTTPS request context, not a deployed TLS/Cloud SQL stack. The browser standalone smoke uses the local demo backend. These distinctions are intentional.

## Not run

- Real Vertex AI generation/ADC permissions/model availability/pricing.
- A live BigQuery export or provisioning job.
- Docker/Compose image execution, image vulnerability scanning, or Cloud Run deployment.
- Production load/chaos testing, independent penetration testing, restore drills, or an accessibility certification.
- Windows launcher execution, real browser speech recognition, or Google Calendar/notification integrations (the latter are not implemented).
