import json
from datetime import timedelta

import pytest
from sqlalchemy import select, update

from backend.db.models import AuthSession, Task, User, utcnow
from backend.scripts.export_analytics import collect_metrics, write_snapshot
from backend.scripts.import_legacy import import_records, read_source
from backend.scripts.maintenance import maintain


def test_analytics_contains_only_aggregate_non_demo_data(authenticated, app):
    authenticated.post("/api/v1/tasks", json={"title": "Private text must never be exported"})
    authenticated.post("/api/v1/auth/demo")
    with app.state.database.sessions() as db:
        result = collect_metrics(db)
    assert result["tasks"] == 1
    assert set(result) == {
        "snapshot_date",
        "recorded_at",
        "tasks",
        "completed_tasks",
        "notes",
        "events",
        "pending_reminders",
    }
    assert "Private text" not in json.dumps(result)


def test_analytics_rejects_untrusted_identifiers_without_cloud_access(app):
    app.state.settings.google_cloud_project = "invalid` SQL"
    with pytest.raises(ValueError):
        write_snapshot({}, app.state.settings)
    app.state.settings.google_cloud_project = "test-project"
    app.state.settings.bigquery_dataset = "dataset`; DROP"
    with pytest.raises(ValueError):
        write_snapshot({}, app.state.settings)


def test_legacy_import_is_dry_run_first_scoped_and_repeatable(authenticated, app, tmp_path):
    source = tmp_path / "mock_db.json"
    source.write_text(
        json.dumps(
            {
                "MOCK_USERS": {"alex@example.com": {"hashed_password": "NEVER IMPORT THIS HASH"}},
                "MOCK_TASKS": [
                    {
                        "user_id": "alex@example.com",
                        "task_name": "Retain my due date",
                        "deadline": "2027-01-01T09:30:00",
                        "status": "pending",
                        "created_at": "2026-01-01",
                    },
                    {
                        "user_id": "alex@example.com",
                        "task_name": "Retain my due date",
                        "deadline": None,
                        "status": "completed",
                        "created_at": "2026-01-02",
                    },
                    {"user_id": "someone@example.com", "task_name": "Another owner's task"},
                ],
                "MOCK_NOTES": [
                    {
                        "user_id": "alex@example.com",
                        "content": "A note",
                        "action_items": '["An action"]',
                    }
                ],
            }
        )
    )
    data, fingerprint = read_source(source)
    assert "MOCK_USERS" not in data
    with app.state.database.sessions() as db:
        user = db.scalar(select(User).where(User.email == "alex@example.com"))
        previous_hash = user.hashed_password
        dry = import_records(db, data, fingerprint, "alex@example.com", user, "Asia/Kolkata")
        assert dry["planned"]["tasks"] == 1 and dry["applied"] is False
        assert db.scalar(select(Task)) is None
        applied = import_records(
            db, data, fingerprint, "alex@example.com", user, "Asia/Kolkata", True
        )
        assert applied["applied"] is True
        task = db.scalar(select(Task))
        assert task.status == "completed"
        assert task.due_at.isoformat() == "2027-01-01T04:00:00+00:00"
        assert user.hashed_password == previous_hash
        again = import_records(
            db, data, fingerprint, "alex@example.com", user, "Asia/Kolkata", True
        )
        assert again["already_imported"] == 2
        assert sum(again["planned"].values()) == 0


def test_invalid_legacy_data_prevents_partial_import(authenticated, app):
    data = {
        "tasks": [
            {"user_id": "alex@example.com", "task_name": "Valid"},
            {"user_id": "alex@example.com", "task_name": "Invalid date", "deadline": "not a date"},
        ]
    }
    with app.state.database.sessions() as db:
        user = db.scalar(select(User))
        report = import_records(db, data, "source", "alex@example.com", user, "UTC", True)
        assert report["invalid_rows"] and report["applied"] is False
        assert db.scalar(select(Task)) is None


def test_legacy_array_directory_support(tmp_path):
    (tmp_path / "notes.json").write_text(
        json.dumps([{"content": "Note", "user_id": "alex@example.com"}])
    )
    data, fingerprint = read_source(tmp_path)
    assert len(data["notes"]) == 1 and len(fingerprint) == 64


def test_maintenance_does_not_delete_active_demos_or_regular_accounts(authenticated, app):
    first_demo = authenticated.post("/api/v1/auth/demo").json()["user"]["id"]
    second_demo = authenticated.post("/api/v1/auth/demo").json()["user"]["id"]
    with app.state.database.sessions() as db:
        db.execute(update(User).values(created_at=utcnow() - timedelta(days=2)))
        db.execute(
            update(AuthSession)
            .where(AuthSession.user_id == first_demo)
            .values(expires_at=utcnow() - timedelta(hours=1))
        )
        db.commit()
        dry = maintain(db, 24)
        assert dry["inactive_demo_accounts"] == 1 and dry["expired_sessions"] == 1
        assert db.get(User, first_demo) is not None
        result = maintain(db, 24, apply=True)
        db.expire_all()
        assert result["applied"] is True
        assert db.get(User, first_demo) is None
        assert db.get(User, second_demo) is not None
        assert db.scalar(select(User).where(User.email == "alex@example.com")) is not None


def test_partitioned_preview_cookie_is_explicit_and_secure(client, app):
    app.state.settings.cookie_secure = True
    app.state.settings.cookie_samesite = "none"
    app.state.settings.cookie_partitioned = True
    response = client.post("/api/v1/auth/demo")
    cookie = response.headers["set-cookie"]
    for attribute in [
        "__Host-aiops_session=",
        "Secure",
        "HttpOnly",
        "SameSite=none",
        "Partitioned",
        "Path=/",
    ]:
        assert attribute in cookie


def test_analytics_client_uses_parameters_billing_limit_and_separate_region(app, monkeypatch):
    from unittest.mock import MagicMock

    from google.cloud import bigquery

    client = MagicMock()
    factory = MagicMock(return_value=client)
    monkeypatch.setattr(bigquery, "Client", factory)
    metrics = {
        "snapshot_date": "2026-09-18",
        "recorded_at": "2026-09-18T12:00:00+00:00",
        "tasks": 2,
        "completed_tasks": 1,
        "notes": 0,
        "events": 0,
        "pending_reminders": 0,
    }
    write_snapshot(metrics, app.state.settings, initialize=True)
    factory.assert_called_once_with(project="aiops-test", location="US")
    assert client.create_dataset.call_args.args[0].location == "US"
    assert client.create_table.call_args.args[0].require_partition_filter is True
    query = client.query.call_args.args[0]
    config = client.query.call_args.kwargs["job_config"]
    assert "MERGE" in query and "@snapshot_date" in query
    assert "2026-09-18" not in query
    assert config.maximum_bytes_billed == 100_000_000
    assert len(config.query_parameters) == 7
    client.query.return_value.result.assert_called_once_with(timeout=30)
    client.close.assert_called_once()
