from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from backend.tests.conftest import PASSWORD


@pytest.mark.parametrize(
    "kind,payload",
    [
        (
            "tasks",
            {"title": "Identical task", "due_at": "2027-02-01T15:00:00+05:30", "priority": "high"},
        ),
        ("notes", {"title": "Identical note", "content": "Private original note"}),
        (
            "events",
            {
                "title": "Identical event",
                "start_time": "2027-02-01T10:00:00Z",
                "end_time": "2027-02-01T11:00:00Z",
            },
        ),
        ("reminders", {"title": "Identical reminder", "urgency": "high"}),
    ],
)
def test_crud_uses_stable_ids_and_ownership(authenticated, second_user, kind, payload):
    first = authenticated.post(f"/api/v1/{kind}", json=payload)
    second = authenticated.post(f"/api/v1/{kind}", json=payload)
    assert first.status_code == second.status_code == 201
    row, duplicate = first.json(), second.json()
    assert row["id"] != duplicate["id"]
    assert "user_id" not in row
    assert second_user.get(f"/api/v1/{kind}").json()["total"] == 0
    edit = {**payload, "title": "New title", "version": row["version"]}
    assert second_user.patch(f"/api/v1/{kind}/{row['id']}", json=edit).status_code == 404
    changed = authenticated.patch(f"/api/v1/{kind}/{row['id']}", json=edit)
    assert changed.status_code == 200
    assert changed.json()["id"] == row["id"]
    assert changed.json()["version"] == row["version"] + 1
    assert authenticated.patch(f"/api/v1/{kind}/{row['id']}", json=edit).status_code == 409
    assert authenticated.delete(f"/api/v1/{kind}/{row['id']}?version=1").status_code == 409
    assert second_user.delete(f"/api/v1/{kind}/{row['id']}?version=2").status_code == 404
    assert authenticated.delete(f"/api/v1/{kind}/{row['id']}?version=2").status_code == 204
    assert authenticated.delete(f"/api/v1/{kind}/{row['id']}?version=2").status_code == 404
    assert authenticated.get(f"/api/v1/{kind}").json()["items"][0]["id"] == duplicate["id"]


def test_task_completion_and_edit_preserve_due_date(authenticated):
    row = authenticated.post(
        "/api/v1/tasks", json={"title": "A deadline", "due_at": "2027-01-01T10:00:00Z"}
    ).json()
    completed = authenticated.patch(
        f"/api/v1/tasks/{row['id']}", json={"status": "completed", "version": 1}
    ).json()
    assert completed["due_at"] == row["due_at"]
    renamed = authenticated.patch(
        f"/api/v1/tasks/{row['id']}", json={"title": "Renamed", "version": 2}
    ).json()
    assert renamed["status"] == "completed" and renamed["due_at"] == row["due_at"]
    reopened = authenticated.patch(
        f"/api/v1/tasks/{row['id']}", json={"status": "pending", "due_at": None, "version": 3}
    ).json()
    assert reopened["due_at"] is None and reopened["status"] == "pending"


@pytest.mark.parametrize(
    "kind,payload",
    [
        ("tasks", {"title": "   "}),
        ("tasks", {"title": "x" * 201}),
        ("tasks", {"title": "Naive date", "due_at": "2027-01-01T10:00:00"}),
        ("tasks", {"title": "Bad priority", "priority": "urgent"}),
        ("notes", {"title": "Empty", "content": "   "}),
        ("notes", {"title": "Oversized", "content": "x" * 8001}),
        (
            "events",
            {
                "title": "Backwards",
                "start_time": "2027-01-01T11:00:00Z",
                "end_time": "2027-01-01T10:00:00Z",
            },
        ),
        (
            "events",
            {
                "title": "Zero length",
                "start_time": "2027-01-01T10:00:00Z",
                "end_time": "2027-01-01T10:00:00Z",
            },
        ),
        ("reminders", {"title": "Invalid", "urgency": "critical"}),
    ],
)
def test_validation_limits(authenticated, kind, payload):
    assert authenticated.post(f"/api/v1/{kind}", json=payload).status_code == 422
    assert authenticated.get(f"/api/v1/{kind}").json()["total"] == 0


def test_invalid_patch_is_not_a_silent_success(authenticated):
    row = authenticated.post("/api/v1/tasks", json={"title": "One"}).json()
    for patch in [
        {"version": 1},
        {"version": 1, "title": None},
        {"version": 1, "status": None},
        {"version": 1, "made_up": "field"},
    ]:
        assert authenticated.patch(f"/api/v1/tasks/{row['id']}", json=patch).status_code == 422


def test_search_filters_pagination_and_literal_wildcards(authenticated):
    for index in range(5):
        authenticated.post(
            "/api/v1/tasks",
            json={"title": f"Project {index}", "priority": "high" if index == 0 else "low"},
        )
    authenticated.post("/api/v1/tasks", json={"title": "Literal %_ query"})
    assert authenticated.get("/api/v1/tasks?q=PROJECT&limit=2&offset=2").json()["total"] == 5
    assert len(authenticated.get("/api/v1/tasks?limit=2&offset=2").json()["items"]) == 2
    assert authenticated.get("/api/v1/tasks?priority=high").json()["total"] == 1
    assert authenticated.get("/api/v1/tasks", params={"q": "%_"}).json()["total"] == 1
    assert authenticated.get("/api/v1/tasks", params={"q": "' OR 1=1 --"}).json()["total"] == 0
    for query in ["limit=101", "limit=0", "offset=-1", "q=" + "x" * 201]:
        assert authenticated.get(f"/api/v1/tasks?{query}").status_code == 422


def test_calendar_overlap_filter_handles_multi_day_events(authenticated):
    payload = {
        "title": "Overnight",
        "start_time": "2027-01-01T23:00:00Z",
        "end_time": "2027-01-02T02:00:00Z",
    }
    authenticated.post("/api/v1/events", json=payload)
    response = authenticated.get(
        "/api/v1/events",
        params={"from_time": "2027-01-02T00:00:00Z", "to_time": "2027-01-03T00:00:00Z"},
    )
    assert response.status_code == 200 and response.json()["total"] == 1
    assert (
        authenticated.get("/api/v1/events", params={"from_time": "2027-01-02T02:00:00Z"}).json()[
            "total"
        ]
        == 0
    )
    assert (
        authenticated.get(
            "/api/v1/events",
            params={"from_time": "2027-01-02T00:00:00Z", "to_time": "2027-01-01T00:00:00Z"},
        ).status_code
        == 422
    )


def test_storage_errors_are_not_reported_as_saved(authenticated, monkeypatch):
    def fail(_):
        raise SQLAlchemyError("private password and SQL must not leak")

    monkeypatch.setattr(Session, "commit", fail)
    response = authenticated.post("/api/v1/tasks", json={"title": "Fails to save"})
    assert response.status_code == 503
    assert "private password" not in response.text
    assert authenticated.get("/api/v1/tasks").json()["total"] == 0


def test_concurrent_edits_reject_lost_updates(authenticated, app):
    row = authenticated.post("/api/v1/tasks", json={"title": "Concurrent"}).json()
    clients = [TestClient(app), TestClient(app)]
    for client in clients:
        login = client.post(
            "/api/v1/auth/login", json={"email": "alex@example.com", "password": PASSWORD}
        ).json()
        client.headers["X-CSRF-Token"] = login["csrf_token"]
    with ThreadPoolExecutor(max_workers=2) as executor:
        responses = list(
            executor.map(
                lambda pair: (
                    pair[1]
                    .patch(
                        f"/api/v1/tasks/{row['id']}",
                        json={"title": f"Version {pair[0]}", "version": 1},
                    )
                    .status_code
                ),
                enumerate(clients),
            )
        )
    assert sorted(responses) == [200, 409]
    for client in clients:
        client.close()


def test_export_contains_only_the_owner_and_no_credentials(authenticated, second_user):
    authenticated.post("/api/v1/tasks", json={"title": "My own task"})
    second_user.post("/api/v1/tasks", json={"title": "Another person's task"})
    response = authenticated.get("/api/v1/users/me/export")
    assert response.status_code == 200
    assert response.headers["content-disposition"].startswith("attachment")
    assert response.json()["format_version"] == 2
    assert response.json()["truncated_collections"] == []
    assert "My own task" in response.text
    for secret in ["Another person's task", "hashed_password", "csrf_token", "token_hash"]:
        assert secret not in response.text


def test_dashboard_counts_are_scoped(authenticated, second_user):
    authenticated.post("/api/v1/tasks", json={"title": "Overdue", "due_at": "2020-01-01T00:00:00Z"})
    second_user.post("/api/v1/tasks", json={"title": "Other user's task"})
    counts = authenticated.get("/api/v1/dashboard").json()["counts"]
    assert counts["tasks"] == counts["pending"] == counts["overdue"] == 1
    assert counts["completed"] == 0


def test_export_reports_row_truncation_and_rate_limit(authenticated, monkeypatch):
    from backend.api import export

    monkeypatch.setattr(export, "EXPORT_LIMIT", 1)
    authenticated.post("/api/v1/tasks", json={"title": "First"})
    authenticated.post("/api/v1/tasks", json={"title": "Second"})
    response = authenticated.get("/api/v1/users/me/export")
    assert len(response.json()["tasks"]) == 1
    assert response.json()["truncated_collections"] == ["tasks"]
    assert authenticated.get("/api/v1/users/me/export").status_code == 200
    limited = authenticated.get("/api/v1/users/me/export")
    assert limited.status_code == 429 and "retry-after" in limited.headers


def test_export_respects_total_byte_budget(authenticated, monkeypatch):
    from backend.api import export

    monkeypatch.setattr(export, "EXPORT_BYTE_LIMIT", 6000)
    authenticated.post("/api/v1/notes", json={"title": "Large note", "content": "長" * 3000})
    result = authenticated.get("/api/v1/users/me/export")
    assert len(result.content) <= 6000
    assert "notes" in result.json()["truncated_collections"]
    assert result.json()["notes"] == []
