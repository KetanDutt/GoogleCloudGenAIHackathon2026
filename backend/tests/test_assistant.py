from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event, select, update
from sqlalchemy.exc import SQLAlchemyError

from backend.db.models import ChatRun, Note, utcnow
from backend.models.schemas import Proposal
from backend.services.vertex_client import AIUnavailable
from backend.tests.conftest import PASSWORD


def propose(client, text="Add task: Review the plan", request_id=None):
    return client.post(
        "/api/v1/chat", json={"user_input": text, "request_id": request_id or str(uuid4())}
    )


@pytest.mark.parametrize(
    "text,intent,collection,count",
    [
        ("Plan my week", "planner", "tasks", 3),
        ("Add task: Finish a draft", "planner", "tasks", 1),
        ("Summarize this meeting: We discussed the launch", "notes", "notes", 1),
        ("Schedule focus tomorrow at 10am", "calendar", "events", 1),
        ("Remind me to review tomorrow at 9am", "reminder", "reminders", 1),
    ],
)
def test_demo_routes_all_agents_and_requires_confirmation(
    authenticated, text, intent, collection, count
):
    response = propose(authenticated, text)
    assert response.status_code == 201
    run = response.json()
    assert run["mode"] == "demo" and run["intent"] == intent
    assert len(run["proposal"][collection]) == count
    assert authenticated.get(f"/api/v1/{collection}").json()["total"] == 0
    saved = authenticated.post(f"/api/v1/chat/{run['id']}/apply")
    assert saved.status_code == 200 and saved.json()["status"] == "applied"
    assert authenticated.get(f"/api/v1/{collection}").json()["total"] == count
    retried = authenticated.post(f"/api/v1/chat/{run['id']}/apply")
    assert retried.json()["applied_ids"] == saved.json()["applied_ids"]
    assert authenticated.get(f"/api/v1/{collection}").json()["total"] == count


@pytest.mark.parametrize(
    "text", ["Hello there", "Schedule a meeting sometime", "Schedule a meeting tomorrow at 99:90"]
)
def test_unclear_demo_requests_do_not_invent_dates_or_create_records(authenticated, text):
    run = propose(authenticated, text).json()
    assert run["status"] == "info"
    assert run["proposal"]["events"] == []
    assert authenticated.post(f"/api/v1/chat/{run['id']}/apply").status_code == 409


def test_proposals_are_idempotent_and_persisted(authenticated):
    request_id = str(uuid4())
    first = propose(authenticated, request_id=request_id).json()
    second = propose(authenticated, request_id=request_id).json()
    assert first["id"] == second["id"]
    assert authenticated.get("/api/v1/chat").json()["total"] == 1
    assert propose(authenticated, "Plan something else", request_id).status_code == 409


def test_cross_account_proposals_cannot_be_applied_or_discarded(authenticated, second_user):
    run = propose(authenticated).json()
    for action in ["apply", "discard"]:
        assert second_user.post(f"/api/v1/chat/{run['id']}/{action}").status_code == 404
    assert second_user.get("/api/v1/chat").json()["items"] == []


def test_discard_and_expiry(authenticated, app):
    run = propose(authenticated).json()
    assert authenticated.post(f"/api/v1/chat/{run['id']}/discard").status_code == 200
    assert authenticated.post(f"/api/v1/chat/{run['id']}/apply").status_code == 409
    expired = propose(authenticated).json()
    with app.state.database.sessions() as db:
        db.execute(
            update(ChatRun)
            .where(ChatRun.id == expired["id"])
            .values(created_at=utcnow() - timedelta(days=2))
        )
        db.commit()
    assert authenticated.post(f"/api/v1/chat/{expired['id']}/apply").status_code == 409
    assert authenticated.get("/api/v1/tasks").json()["total"] == 0


def test_clear_history_does_not_delete_saved_items(authenticated):
    run = propose(authenticated).json()
    authenticated.post(f"/api/v1/chat/{run['id']}/apply")
    assert authenticated.delete("/api/v1/chat").status_code == 204
    assert authenticated.get("/api/v1/chat").json()["total"] == 0
    assert authenticated.get("/api/v1/tasks").json()["total"] == 1


def test_model_allowlist_and_input_validation(authenticated):
    assert (
        authenticated.post(
            "/api/v1/chat", json={"user_input": "  ", "request_id": str(uuid4())}
        ).status_code
        == 422
    )
    assert (
        authenticated.post(
            "/api/v1/chat", json={"user_input": "Plan", "request_id": "not-a-uuid"}
        ).status_code
        == 422
    )
    assert (
        authenticated.post(
            "/api/v1/chat",
            json={
                "user_input": "Plan",
                "request_id": str(uuid4()),
                "model_name": "unapproved-model",
            },
        ).status_code
        == 422
    )


def test_cloud_failure_does_not_silently_fall_back_or_leak_details(authenticated, app, monkeypatch):
    app.state.settings.ai_mode = "vertex"

    def fail():
        raise RuntimeError("private cloud account information")

    monkeypatch.setattr(app.state.vertex, "_get_client", fail)
    response = propose(authenticated)
    assert response.status_code == 503
    assert "private cloud account" not in response.text
    assert authenticated.get("/api/v1/tasks").json()["total"] == 0
    assert authenticated.get("/api/v1/chat").json()["total"] == 0


def test_cloud_schema_validation_and_two_call_budget(authenticated, app, monkeypatch):
    app.state.settings.ai_mode = "vertex"
    calls = []

    def generate(prompt, schema, model):
        calls.append(schema.__name__)
        if schema.__name__ == "IntentResult":
            return schema.model_validate({"intent": "planner"})
        return schema.model_validate(
            {
                "message": "Review these tasks",
                "tasks": [{"title": f"Task {index}"} for index in range(8)],
            }
        )

    monkeypatch.setattr(app.state.vertex, "generate", generate)
    response = propose(authenticated)
    assert response.status_code == 201
    assert calls == ["IntentResult", "TaskPlan"]
    assert len(response.json()["proposal"]["tasks"]) == 8
    assert authenticated.get("/api/v1/tasks").json()["total"] == 0


def test_malformed_cloud_output_is_not_saved(authenticated, app, monkeypatch):
    app.state.settings.ai_mode = "vertex"
    fake = SimpleNamespace(
        models=SimpleNamespace(
            generate_content=lambda **_: SimpleNamespace(text='{"intent":"planner or calendar"}')
        )
    )
    monkeypatch.setattr(app.state.vertex, "_get_client", lambda: fake)
    response = propose(authenticated)
    assert response.status_code == 502
    assert "Nothing was saved" in response.json()["detail"]
    assert authenticated.get("/api/v1/chat").json()["total"] == 0


def test_disabled_ai_leaves_manual_workspace_usable(authenticated, app):
    app.state.settings.ai_mode = "disabled"
    assert propose(authenticated).status_code == 503
    assert authenticated.post("/api/v1/tasks", json={"title": "Manual task"}).status_code == 201


def test_concurrency_slots_and_rate_limits(authenticated, app):
    app.state.settings.chat_rate_limit = 1
    assert propose(authenticated).status_code == 201
    assert propose(authenticated).status_code == 429
    for _ in range(4):
        app.state.workflow.slots.acquire()
    try:
        with pytest.raises(AIUnavailable):
            app.state.workflow.propose("Plan", "UTC", "gemini-2.5-flash")
    finally:
        for _ in range(4):
            app.state.workflow.slots.release()


def test_apply_is_atomic_on_a_mid_batch_failure(authenticated, app):
    run = propose(authenticated, "Plan my week").json()
    inserts = 0

    def fail_second_insert(connection, cursor, statement, parameters, context, executemany):
        nonlocal inserts
        if statement.startswith("INSERT INTO tasks"):
            inserts += 1
            if inserts == 2:
                raise SQLAlchemyError("simulated storage error")

    event.listen(app.state.database.engine, "before_cursor_execute", fail_second_insert)
    try:
        response = authenticated.post(f"/api/v1/chat/{run['id']}/apply")
        assert response.status_code == 503
    finally:
        event.remove(app.state.database.engine, "before_cursor_execute", fail_second_insert)
    assert authenticated.get("/api/v1/tasks").json()["total"] == 0
    assert authenticated.get("/api/v1/chat").json()["items"][0]["status"] == "pending"
    assert authenticated.post(f"/api/v1/chat/{run['id']}/apply").status_code == 200
    assert authenticated.get("/api/v1/tasks").json()["total"] == 3


def test_concurrent_confirmations_create_only_one_batch(authenticated, app):
    run = propose(authenticated, "Plan my week").json()
    clients = [TestClient(app), TestClient(app)]
    for client in clients:
        result = client.post(
            "/api/v1/auth/login", json={"email": "alex@example.com", "password": PASSWORD}
        ).json()
        client.headers["X-CSRF-Token"] = result["csrf_token"]
    with ThreadPoolExecutor(max_workers=2) as executor:
        responses = list(
            executor.map(lambda client: client.post(f"/api/v1/chat/{run['id']}/apply"), clients)
        )
    assert [r.status_code for r in responses] == [200, 200]
    assert responses[0].json()["applied_ids"] == responses[1].json()["applied_ids"]
    assert authenticated.get("/api/v1/tasks").json()["total"] == 3
    for client in clients:
        client.close()


def test_editing_note_content_invalidates_old_summary(authenticated, app):
    run = propose(authenticated, "Save a note: Original source").json()
    applied = authenticated.post(f"/api/v1/chat/{run['id']}/apply").json()
    note_id = applied["applied_ids"]["notes"][0]
    with app.state.database.sessions() as db:
        note = db.scalar(select(Note).where(Note.id == note_id))
        note.summary, note.action_items = "An outdated summary", ["An outdated action"]
        db.commit()
    response = authenticated.patch(
        f"/api/v1/notes/{note_id}", json={"content": "New source content", "version": 1}
    )
    assert response.status_code == 200
    assert response.json()["summary"] is None
    assert response.json()["action_items"] == []


def test_total_actions_are_bounded():
    with pytest.raises(ValueError):
        Proposal(
            message="Too many", tasks=[{"title": "Task"}] * 8, reminders=[{"title": "Reminder"}]
        )


def test_no_paid_health_probes(client, app, monkeypatch):
    def unexpected(*args, **kwargs):
        raise AssertionError("A health check must not contact the model")

    monkeypatch.setattr(app.state.vertex, "generate", unexpected)
    monkeypatch.setattr(app.state.vertex, "_get_client", unexpected)
    assert client.get("/health").json()["status"] == "ok"
    assert client.get("/ready").json()["ready"] is True
    assert client.get("/api/v1/status").json()["ai_mode"] == "demo"


def test_demo_empty_explicit_task_asks_for_details(authenticated):
    result = propose(authenticated, "Add task:")
    assert result.status_code == 201
    assert result.json()["status"] == "info"
    assert result.json()["proposal"]["tasks"] == []
