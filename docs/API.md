# API guide (v2)

The backend exposes `/api/v1`. In the browser, use the **same-origin** Next proxy at that same prefix. `/health` and `/ready` are backend infrastructure endpoints. Local Swagger UI is at `http://localhost:8080/docs`; interactive docs/OpenAPI serving are disabled in production. The checked-in [OpenAPI reference](openapi.json) remains available for integration work.

## Sessions and CSRF

`POST /auth/register` accepts `email`, a 12–128-character `password`, `username` (2–60 characters), optional avatar ID `1`–`10`, and an IANA `timezone` (default UTC).

`POST /auth/login` accepts JSON email/password. Both return:

```json
{
  "user": {
    "id": "uuid",
    "email": "you@example.com",
    "username": "You",
    "avatar": "1",
    "timezone": "UTC",
    "is_demo": false,
    "created_at": "2026-09-18T09:00:00Z"
  },
  "csrf_token": "opaque-session-bound-value"
}
```

They also set an **HttpOnly session cookie**. Do not copy this cookie into JavaScript, localStorage, URLs, or logs. Keep `csrf_token` in memory and send it as `X-CSRF-Token` on authenticated POST/PATCH/DELETE operations. `GET /auth/session` restores the current user/CSRF value after reload. Cookies are validated against revocable hashed server-side sessions on each authenticated request.

- `POST /auth/logout` invalidates the current session and clears its cookie (also works for an expired server session with the matching CSRF value).
- `POST /auth/demo` creates a new private demo account only when enabled outside production.
- `GET /users/me`, `PATCH /users/me`: profile preferences; new passwords require the current password and revoke other sessions. The response contains the new CSRF value when the session rotates.
- `GET /users/me/export`: credential-free JSON attachment. Includes truncation metadata if any collection exceeds 10,000 items or the whole export reaches an 8 MiB byte budget. Limited to two exports per user per minute.
- `DELETE /users/me`: JSON `{ "current_password": "..." }`, CSRF, and reauthentication; cascades all owned data. A demo account does not have a user-known password and does not require one for its own deletion.

Email changes, password recovery, and email verification are not implemented. Registration is not proof of email ownership.

## Workspace resources

| Resource     | Create fields                                                         | Update behavior                                                                                      |
| ------------ | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `/tasks`     | `title`, optional aware `due_at`, `priority: low/medium/high`         | Partial PATCH: title/due date/priority/status; pending/completed can be toggled both ways.           |
| `/notes`     | `title`, `content`                                                    | Partial PATCH. Changing content clears stale summary/action items.                                   |
| `/events`    | `title`, aware `start_time`, aware `end_time`, optional `description` | PATCH requires the complete event fields plus version, so its time range is validated together.      |
| `/reminders` | `title`, optional aware `due_at`, `urgency`, optional `suggestion`    | Partial PATCH including pending/completed status. Records only; no background notification delivery. |

Use `POST /resource`, `PATCH /resource/{uuid}`, and `DELETE /resource/{uuid}?version=N`. A create returns `201`, edits return `200`, and deletes return `204` with no JSON body. List responses never expose internal owner IDs or credentials.

Every record has `id`, `version`, `created_at`, and `updated_at`. Titles are 1–200 trimmed characters; note/message content is at most 8,000. Event ends must be after starts. Input timestamps require timezone offsets; they are stored/returned in UTC. `null` explicitly clears a task/reminder due date; an omitted field preserves it.

### Optimistic concurrency

```http
PATCH /api/v1/tasks/ITEM_UUID
Content-Type: application/json
X-CSRF-Token: SESSION_CSRF

{"version": 3, "status": "completed"}
```

On success, the same UUID returns with version 4 and the original due date. If another tab has edited version 3, you get `409`; refetch and review before retrying. Duplicate titles are separate records. Names and note contents are never identifiers.

### Pagination and filters

```http
GET /api/v1/tasks?limit=20&offset=0&q=launch&priority=high&status=pending
```

```json
{ "items": [], "total": 0, "limit": 20, "offset": 0 }
```

- `limit`: 1–100; default 20 (events default 100). `offset`: 0–100,000.
- `q`: literal, database-collation-dependent case-insensitive title search for tasks/reminders; title/content for notes. `%`/`_` are escaped, not SQL wildcards. Maximum 200 characters.
- Tasks: `status`, `priority`, `overdue=true` (pending with due time before now).
- Reminders: `status`.
- Events: `from_time`, `to_time`; ranges use overlap semantics with an exclusive end, so overnight events are included.
- Lists have deterministic tie-breakers. Offset pagination is not a snapshot across concurrent changes; cursor pagination is a future scalability improvement.

`GET /dashboard` returns aggregate counts and bounded priority/event/note previews, not the entire workspace. `GET /status` returns configuration/provider-observation status, the model allowlist, storage type, and explicit limitations. `configured` is **not** a successful live cloud probe.

## Assistant: propose, then confirm

```http
POST /api/v1/chat
Content-Type: application/json
X-CSRF-Token: SESSION_CSRF

{"user_input":"Add task: Review the launch brief","request_id":"e1a600aa-b9c5-4589-a381-b41b46dc90be"}
```

Optional `model_name` must be in the configured allowlist. Retain the request UUID when retrying an uncertain transport result; reuse with different content returns `409`.

The response includes `id`, `mode`, `intent`, `status`, `proposal` (message + typed tasks/notes/events/reminders), `trace`, and `applied_ids`. A response is a **proposal**, not a successful workspace mutation.

- `GET /chat?limit=20&offset=0`: newest-first persisted history.
- `POST /chat/{id}/apply`: authenticate/authorize, validate, atomically create the whole batch. Repeated successful confirmations return the original IDs. Pending proposals expire after 24 hours.
- `POST /chat/{id}/discard`: changes only a pending proposal; creates no workspace items.
- `DELETE /chat`: clears history/proposals, not previously saved workspace records.

Statuses: `pending`, `applied`, `discarded`, `info` (no actions). Review proposed dates, names, and assumptions; structured validation is not a guarantee of semantic correctness. Each prompt is independent, not a multi-turn memory context.

## Errors and retry policy

| Status | Meaning / action                                                                                    |
| ------ | --------------------------------------------------------------------------------------------------- |
| `401`  | Sign in again. Invalid credentials and unknown login emails share a generic message.                |
| `403`  | Bad origin/CSRF token or prohibited operation. Refresh session state; do not blindly replay writes. |
| `404`  | Missing item **or another user's item**.                                                            |
| `409`  | Stale version, duplicate email, changed request UUID payload, expired/discarded proposal.           |
| `413`  | Request exceeds the 64 KiB body limit.                                                              |
| `422`  | Invalid fields; sanitized issue details exclude submitted values.                                   |
| `429`  | Request guard hit; honor `Retry-After`.                                                             |
| `502`  | Model response could not be validated; no proposal/workspace items saved.                           |
| `503`  | Storage/model/upstream unavailable. Refresh to establish whether a write committed before retrying. |

Responses are `Cache-Control: no-store` and include `X-Request-ID` for support/log correlation. Transport timeouts are ambiguous for ordinary manual creates; they have no idempotency key. Only chat proposal creation and confirmation have explicit idempotency semantics. The browser does not automatically retry mutations.
