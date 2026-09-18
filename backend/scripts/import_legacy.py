"""Offline import of one legacy owner's work into an existing v2 account; never import hashes."""

import argparse
import hashlib
import json
from datetime import UTC, datetime
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5
from zoneinfo import ZoneInfo

from sqlalchemy import select

from backend.config.settings import Settings
from backend.db.database import Database
from backend.db.models import Event, Note, Reminder, Task, User
from backend.models.schemas import EventCreate, ReminderCreate, SuggestedNote, TaskCreate

MAX_SOURCE_BYTES = 16 * 1024 * 1024
KINDS = ("tasks", "notes", "events", "reminders")


def read_source(path: Path) -> tuple[dict, str]:
    files = [path / f"{kind}.json" for kind in KINDS] if path.is_dir() else [path]
    data, fingerprint, size = {}, hashlib.sha256(), 0
    for source in files:
        if not source.is_file():
            continue
        size += source.stat().st_size
        if size > MAX_SOURCE_BYTES:
            raise ValueError("Legacy sources must be at most 16 MiB. Split larger exports first.")
        raw = source.read_bytes()
        fingerprint.update(raw)
        parsed = json.loads(raw.decode("utf-8-sig"))
        if path.is_dir():
            data[source.stem] = parsed
        elif isinstance(parsed, dict):
            data = {
                kind: parsed.get(f"MOCK_{kind.upper()}", parsed.get(kind, [])) for kind in KINDS
            }
        else:
            raise ValueError("Expected a mock_db JSON object or a directory of table JSON arrays")
    if not data or any(not isinstance(data.get(kind, []), list) for kind in KINDS):
        raise ValueError("No valid workspace table arrays were found")
    return data, fingerprint.hexdigest()


def legacy_date(value, timezone: str):
    if value in (None, "", "Unknown"):
        return None
    parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=ZoneInfo(timezone))
    return parsed.astimezone(UTC)


def import_records(
    db,
    data: dict,
    fingerprint: str,
    legacy_email: str,
    target: User,
    timezone: str,
    apply: bool = False,
):
    ZoneInfo(timezone)
    report = {
        "planned": {kind: 0 for kind in KINDS},
        "already_imported": 0,
        "invalid_rows": [],
        "applied": False,
    }
    prepared = []
    for kind in KINDS:
        rows = [
            row
            for row in data.get(kind, [])
            if isinstance(row, dict)
            and str(row.get("user_id", "")).strip().lower() == legacy_email.strip().lower()
        ]
        if kind == "tasks":
            # The old schema was an append-only ledger keyed by task text.
            latest = {}
            for row in sorted(rows, key=lambda row: str(row.get("created_at", ""))):
                title = row.get("task_name")
                previous = latest.get(title, {})
                latest[title] = {**row, "deadline": row.get("deadline") or previous.get("deadline")}
            rows = [row for row in latest.values() if row.get("status") != "deleted"]
        for index, row in enumerate(rows):
            identifier = str(
                uuid5(NAMESPACE_URL, f"aiops-v1:{fingerprint}:{target.id}:{kind}:{index}")
            )
            model = {"tasks": Task, "notes": Note, "events": Event, "reminders": Reminder}[kind]
            if db.get(model, identifier):
                report["already_imported"] += 1
                continue
            try:
                if kind == "tasks":
                    values = TaskCreate(
                        title=row.get("task_name"),
                        due_at=legacy_date(row.get("deadline"), timezone),
                    ).model_dump()
                    values["status"] = (
                        "completed" if row.get("status") == "completed" else "pending"
                    )
                elif kind == "notes":
                    actions = row.get("action_items") or []
                    if isinstance(actions, str):
                        actions = json.loads(actions)
                    values = SuggestedNote(
                        title=(
                            row.get("title")
                            or row.get("summary")
                            or row.get("content")
                            or "Imported note"
                        )[:200],
                        content=row.get("content"),
                        summary=row.get("summary"),
                        action_items=actions,
                    ).model_dump()
                elif kind == "events":
                    values = EventCreate(
                        title=row.get("title"),
                        start_time=legacy_date(row.get("start_time"), timezone),
                        end_time=legacy_date(row.get("end_time"), timezone),
                    ).model_dump()
                else:
                    values = ReminderCreate(
                        title=row.get("task"),
                        urgency=row.get("urgency", "medium"),
                        suggestion=row.get("suggestion") or "",
                    ).model_dump()
                prepared.append(model(id=identifier, user_id=target.id, **values))
                report["planned"][kind] += 1
            except (ValueError, TypeError, AttributeError):
                report["invalid_rows"].append(
                    {
                        "collection": kind,
                        "owner_row_index": index,
                        "reason": "Invalid or oversized fields; review this source row before importing.",
                    }
                )
    if apply and not report["invalid_rows"]:
        db.add_all(prepared)
        db.commit()
        report["applied"] = True
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "source", type=Path, help="mock_db.json or a folder of table JSON arrays; keep outside Git"
    )
    parser.add_argument("--legacy-email", required=True)
    parser.add_argument(
        "--target-email", required=True, help="An existing, newly registered v2 account"
    )
    parser.add_argument(
        "--legacy-timezone", required=True, help="IANA zone for old naive timestamps; do not guess"
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Import atomically after validation; default is a dry run",
    )
    args = parser.parse_args()
    database = Database(Settings())
    try:
        data, fingerprint = read_source(args.source)
        with database.sessions() as db:
            user = db.scalar(
                select(User).where(
                    User.email == args.target_email.strip().lower(), User.is_demo.is_(False)
                )
            )
            if user is None:
                parser.error("Create the destination personal account first")
            report = import_records(
                db, data, fingerprint, args.legacy_email, user, args.legacy_timezone, args.apply
            )
            print(json.dumps(report, indent=2))
            if report["invalid_rows"]:
                raise SystemExit(2)
    finally:
        database.engine.dispose()


if __name__ == "__main__":
    main()
