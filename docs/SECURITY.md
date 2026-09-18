# Security and privacy

## Reporting

Report vulnerabilities privately to the repository owner. Use GitHub private vulnerability reporting if enabled; otherwise arrange a private channel with the maintainer. Do not publish credentials, session cookies, real exports, password hashes, or user content in an issue. No dedicated disclosure email or security response SLA is claimed.

## Historical data exposure

Credential-bearing v1 backups and the mock account database were removed from the working tree and added to ignore rules. **Their historical Git objects were not rewritten.** Treat affected old passwords/hashes and JWT signing material as exposed. Rotate reused passwords, revoke old authentication material, and coordinate any history cleanup with the repository owner. Removing a file is not credential rotation. See [Migration](MIGRATION.md).

## Controls implemented

- **Authentication:** Argon2id hashes (19 MiB, time cost 2, parallelism 1), unique normalized account emails, bounded Unicode passphrases, generic login failure, and equal-cost verification for unknown accounts.
- **Sessions:** random opaque tokens, only SHA-256 token hashes in the database, absolute expiry, server-side revocation, HttpOnly cookies, SameSite=Lax by default. Production requires Secure and a `__Host-` name (Path=/, no Domain). JavaScript stores only the CSRF value in memory; retired localStorage tokens are removed.
- **CSRF:** session-bound HMAC token for authenticated mutations plus origin checks. Signup/login/demo also reject untrusted mutating origins. A deliberately configured HTTPS iframe can use Secure/SameSite=None/Partitioned cookies without turning off CSRF.
- **Authorization:** every lookup/list/update/delete/assistant confirmation is owner-scoped. Missing and foreign-owner records both return 404. The client cannot choose a stored record's owner. Exports exclude credentials and other users.
- **Data integrity:** UUID identity, uniqueness/FKs/checks, UTC dates, ordered event ranges, schema validation, optimistic versions, and transactionally applied assistant proposals. Account deletion cascades to owned records and sessions.
- **Model boundary:** allowlisted models, limited calls/concurrency/output, no arbitrary model tools, no autonomous saves, explicit confirmation, and no silent cloud-to-demo fallback. Text is rendered as escaped React text, not raw HTML/Markdown execution.
- **Abuse/resource controls:** bounded JSON bodies, chunked-body enforcement, body-read timeout, pagination, bounded history/proposals, process-local auth/chat/export throttles, and count/byte-bounded exports. Clients do not automatically retry writes.
- **Transport/browser boundary:** same-origin server proxy, fixed upstream, restricted forwarded headers, request timeouts, no-store API responses, nosniff/referrer/permissions headers, and a baseline production CSP with same-origin framing.
- **Operational safety:** redacted validation/configuration errors, request IDs and route-template logs, non-root images, no model/BigQuery probes at startup/health endpoints, ignored runtime files, explicit migrations, and dry-run-first administrative tools/deployment planning.

These controls reduce identified risks; they do not establish compliance or constitute an independent penetration test.

## Data recipients

| Data                                      | Where it goes                                                                                                                                                                                             |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Account preferences and workspace records | The configured SQLite/PostgreSQL database and your chosen backup systems                                                                                                                                  |
| Password                                  | Verified/hashed by the backend; hash stored in the operational database; never sent to Vertex or BigQuery                                                                                                 |
| Session token                             | HttpOnly browser cookie; hash in the session table; never a browser-localStorage value                                                                                                                    |
| Assistant prompt                          | In demo mode: local templates only. In Vertex mode: Google Vertex AI, along with current time/timezone and bounded instructions. Original prompt + proposal/history are stored in the workspace database. |
| Existing workspace notes/events           | Not automatically fetched into model context; included only if the user explicitly submits their text in a prompt                                                                                         |
| Browser dictation audio                   | May be processed by the browser/vendor's speech service; not by a project-operated audio backend. Browser support and policy vary.                                                                        |
| Analytics                                 | Optional explicit BigQuery job exports only non-demo aggregate counts and timestamps. Even small-cohort aggregates can be sensitive.                                                                      |
| Logs/test artifacts                       | Structured operational metadata in stdout/your log system; browser test traces can include test content, so keep artifacts private and test with fabricated data.                                         |

There is no assertion that a user's cloud tenancy meets a specific residency/retention/compliance regime. Configure region, provider contracts, access, deletion, and retention policies for your use case before handling sensitive information.

## Remaining limitations and required decisions

1. **No verified email, password reset, MFA, or managed-identity integration.** Public signup is not proof of email ownership. Integrate a suitable identity provider or complete these flows before public consumer use. Auth signup conflicts can reveal whether an address is registered.
2. **No distributed abuse control.** Rate limits/concurrency bounds are per process; many requests through one frontend may share a peer-IP bucket. Apply a trusted gateway policy covering both public service URLs. Do not trust arbitrary forwarded IPs or treat instance limits as a billing guarantee.
3. **Baseline CSP permits inline scripts/styles** for Next hydration/theme behavior. A nonce-based CSP and release-specific script policy are a follow-up hardening task. HSTS/custom-domain policy belongs in the HTTPS deployment configuration; local HTTP demos must remain usable.
4. **No production key management/encryption application layer**, team roles, audit-event ledger, anomaly detector, DLP, legal retention, or security monitoring service is provisioned. Managed-database/cloud controls and restricted log access remain operator responsibilities.
5. **No semantic correctness guarantee for AI.** A valid proposal can still contain wrong assumptions. Review dates/names/actions. Browser dates use the browser timezone; assistant interpretation uses the profile timezone.
6. **Deletion is an operational database deletion**, not a claim of immediate purge from all backups, provider systems, logs, or historic Git objects. Publish a realistic retention/deletion policy.
7. **CLI tools are administrator tools.** The legacy importer cannot prove consent/identity. Migration/down-migration, full session revocation, and cloud deployment must be deliberate, access-controlled actions.
8. **No external security/load/container audit was performed.** Dependency scans are point-in-time. Pin/scan release images and action versions, review future advisories, and run staging failure/load tests.

For prioritization and launch gates, see [Audit and roadmap](AUDIT_AND_ROADMAP.md).
