# Changelog

## 2.0.0 — 2026-09-18

### Added

- Transactional SQLite/PostgreSQL persistence, UUIDs, owner isolation, versioned writes, migrations.
- Opaque cookie sessions, CSRF, Argon2id, private demos, profile/password settings, export and account deletion.
- Full task/note/event/reminder CRUD, filtering/search/pagination, a real dashboard, responsive calendar, keyboard search, light/dark UI, accessible dialogs, optional browser dictation.
- Persisted assistant proposals/history, explicit confirm/discard, idempotent transactional application, model allowlist and bounded generation.
- Backend/frontend/browser/accessibility tests, CI, dependency-update checks, deployment/container scaffolding, maintenance/import/aggregate analytics tools, and comprehensive documentation.

### Fixed

- Lost task deadlines, text-based record identity, duplicate/owner-scope bugs, swallowed write failures, stale UI state, and unvalidated dates/output.
- Browser-facing localhost configuration, inconsistent API contracts, weak/noisy auth/error handling, fabricated workflow/status signals, and costly per-task model fan-out.
- Month-end/DST/overnight calendar cases, invalid-opacity theme colors, build-time font resolution, weak contrast, mobile layout density, and checkbox save feedback.
- Unsafe local reset/deployment behavior and accidentally tracked runtime/credential-bearing files.

### Breaking changes

- API now uses `/api/v1`; cookie + CSRF replaces bearer JWT/localStorage authentication.
- Operational BigQuery and mock JSON storage are retired. Production requires PostgreSQL; optional BigQuery integration is aggregate-only analytics.
- Old hashes/JWTs are not imported or accepted. Use fresh credentials and the offline legacy **workspace-data** importer.
- New IDs, versions, pagination, aware-time contracts, and explicit confirmation replace direct assistant writes.
- Deleted the destructive `clean_run_local.ps1`; launchers preserve data and cloud deployment requires explicit execution.

### Known boundaries

No verified email/password reset/MFA, external calendar sync, notification delivery, multi-turn model memory, offline sync, or distributed rate limiter is claimed. Real cloud/container/production verification remains an operator launch gate. Original hackathon media and the existing restrictive project license are retained.
