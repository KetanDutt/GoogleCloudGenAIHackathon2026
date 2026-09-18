# Migrating the original workspace to v2

This release intentionally changes authentication, the API prefix, and operational storage. There is no automatic read/write compatibility with v1 BigQuery tables or `mock_db.json`.

## Critical security prerequisite

The old tracked backups/mock database contained account/password-hash material. It was removed from the current tree and ignored going forward, **but remains in Git history and any clones**.

- Treat the affected old account credentials and old JWT signing material as exposed; invalidate old sessions and require fresh passwords, including rotation wherever a password was reused.
- Revoke/rotate any real cloud credentials that were separately included in historical files/logs. Project IDs and public service URLs are not credentials by themselves.
- If appropriate, the repository owner should coordinate a history rewrite using a tool such as `git filter-repo`, then handle forks/cached copies and team re-cloning. History rewriting was **not** performed automatically because it is disruptive and does not make exposed credentials secret again.
- Do not copy old password hashes into the new database. v2 uses Argon2id and opaque sessions; old bearer JWTs are not accepted.

## Safe migration sequence

1. Freeze old writes and take a protected read-only export/backup outside Git. Record which owner each export belongs to and the timezone used for naive timestamps.
2. Create the new PostgreSQL database (or local SQLite workspace), apply `alembic upgrade head`, and start v2 with the appropriate environment.
3. Register the destination personal account with a **fresh** password. Verify the identity/ownership through your trusted operational process; the import utility is an offline administrator tool, not a public endpoint.
4. Review a dry run for one owner:

```bash
.venv/bin/python -m backend.scripts.import_legacy /private/path/mock_db.json \
  --legacy-email person@example.com --target-email person@example.com \
  --legacy-timezone Asia/Kolkata
```

A folder containing `tasks.json`, `notes.json`, `events.json`, and/or `reminders.json` arrays is also supported. This matches ordinary JSON table exports. Missing table files are treated as empty; `users.json` is never read. Files must be UTF-8 (a UTF-8 BOM is accepted), with at most 16 MiB total; split larger exports by owner first. Keep sources read-only and private.

5. Inspect counts and any `invalid_rows` entries. The output contains table/row positions and generic errors, **not** private content or credential values. Fix invalid dates, oversize text, malformed action-item arrays, or unsupported fields in a separately preserved working copy. No partial import occurs when validation errors remain.
6. Run the identical command with `--apply` to import valid records in **one transaction**.
7. Verify the destination counts, titles, original note contents, dates/timezones, task statuses, and deletion behavior. Keep the protected original export until your retention/migration policy permits deletion.
8. Switch traffic only after staging checks, backup/restore validation, and user communication. Never point old code at the new schema.

## Conversion rules and limitations

- Selects only rows whose legacy `user_id` matches `--legacy-email`; the destination is an existing non-demo account. Source account tables, password hashes, tokens, and logs are never imported.
- Old task rows are folded by `task_name` in legacy timestamp order, reflecting the old ledger semantics. A final deleted row stays deleted; a completed row preserves an earlier known deadline instead of losing it. If v1 conflated distinct tasks sharing a title, the import cannot reconstruct the missing identities.
- Notes retain content, summary, and up to eight validated action items. Legacy JSON-encoded action-item arrays are decoded. A missing title is derived from existing note text and shortened; the original content is retained within the current 8,000-character limit.
- Events require complete valid ordered timestamps. Reminders preserve their title, urgency, and suggestion; old reminders without an actual due timestamp remain undated.
- A required IANA `--legacy-timezone` interprets **naive** timestamps. Aware timestamps retain their explicit offset. Inspect DST transitions/ambiguous hours manually; do not guess a timezone or treat naive dates as UTC by default.
- New UUIDs and audit timestamps are assigned. IDs are deterministic for the **identical source bytes + destination account + row positions**, so repeating the same successful import does not duplicate records. **Changing/reordering the export after importing creates a different source identity and can duplicate records.** Do not run every nightly backup as a new import.
- v1 chat transcripts/logs, sessions, account preferences, and histories are not migrated. v2 user exports are not the legacy import format; a general v2 import endpoint is not implemented.
- The utility runs with administrator database access and cannot itself prove an email owner’s consent. Do not expose it as an authenticated web route or automate imports for unverified claimants.

The removed `clean_run_local.ps1` could reset cloud data during what appeared to be local startup. Use the new non-destructive launchers and explicit migration commands instead; never execute that old script from Git history against a live project.
