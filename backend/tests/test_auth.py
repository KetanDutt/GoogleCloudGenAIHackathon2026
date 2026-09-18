from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, update

from backend.db.models import AuthSession, Task, User, utcnow
from backend.services.auth_service import token_hash
from backend.tests.conftest import PASSWORD, signup


def test_registration_normalizes_email_and_sets_secure_session_shape(client, app):
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "  ALEX@Example.com ", "username": " Alex ", "password": PASSWORD},
    )
    assert response.status_code == 201
    assert response.json()["user"]["email"] == "alex@example.com"
    assert response.json()["user"]["username"] == "Alex"
    assert "access_token" not in response.json()
    cookie = response.headers["set-cookie"]
    assert "HttpOnly" in cookie and "SameSite=lax" in cookie and "Path=/" in cookie
    raw = client.cookies[app.state.settings.cookie_name]
    with app.state.database.sessions() as db:
        assert db.scalar(select(AuthSession)).token_hash == token_hash(raw)
        assert db.scalar(select(User)).hashed_password.startswith("$argon2id$")
    assert client.get("/api/v1/auth/session").status_code == 200


@pytest.mark.parametrize(
    "payload",
    [
        {"email": "not-an-email", "password": PASSWORD, "username": "Alex"},
        {"email": "alex@example.com", "password": "Secret1!", "username": "Alex"},
        {"email": "alex@example.com", "password": PASSWORD, "username": "  "},
        {
            "email": "alex@example.com",
            "password": PASSWORD,
            "username": "Alex",
            "timezone": "Not/AZone",
        },
        {"email": "alex@example.com", "password": PASSWORD, "username": "Alex", "avatar": "999"},
    ],
)
def test_registration_validation_redacts_inputs(client, payload):
    result = client.post("/api/v1/auth/register", json=payload)
    assert result.status_code == 422
    assert payload["password"] not in result.text
    assert '"input"' not in result.text


def test_duplicate_email_is_a_conflict(client):
    signup(client)
    result = client.post(
        "/api/v1/auth/register",
        json={"email": "ALEX@EXAMPLE.COM", "username": "Other", "password": PASSWORD},
    )
    assert result.status_code == 409


def test_login_supports_long_unicode_passphrases(client):
    phrase = "a long passphrase " + "🔐" * 40
    signup(client, password=phrase)
    result = client.post(
        "/api/v1/auth/login", json={"email": "alex@example.com", "password": phrase}
    )
    assert result.status_code == 200


@pytest.mark.parametrize("email", ["missing@example.com", "alex@example.com"])
def test_login_generic_failure(authenticated, email):
    result = authenticated.post(
        "/api/v1/auth/login", json={"email": email, "password": "incorrect password"}
    )
    assert result.status_code == 401
    assert result.json()["detail"] == "Incorrect email or password."


def test_csrf_and_origin_protection(authenticated):
    csrf = authenticated.headers.pop("X-CSRF-Token")
    assert authenticated.post("/api/v1/tasks", json={"title": "No CSRF"}).status_code == 403
    authenticated.headers["X-CSRF-Token"] = "bad-token"
    assert authenticated.post("/api/v1/tasks", json={"title": "Bad CSRF"}).status_code == 403
    authenticated.headers["X-CSRF-Token"] = csrf
    assert (
        authenticated.post(
            "/api/v1/tasks",
            json={"title": "Wrong origin"},
            headers={"Origin": "https://evil.invalid"},
        ).status_code
        == 403
    )
    assert (
        authenticated.post(
            "/api/v1/tasks", json={"title": "Allowed"}, headers={"Origin": "http://localhost:3000"}
        ).status_code
        == 201
    )


def test_unauthenticated_access(client):
    for endpoint in [
        "tasks",
        "notes",
        "events",
        "reminders",
        "chat",
        "dashboard",
        "users/me/export",
    ]:
        assert client.get(f"/api/v1/{endpoint}").status_code == 401


def test_logout_revokes_server_session(authenticated, app):
    raw = authenticated.cookies[app.state.settings.cookie_name]
    assert authenticated.post("/api/v1/auth/logout").status_code == 204
    authenticated.cookies.set(app.state.settings.cookie_name, raw)
    assert authenticated.get("/api/v1/auth/session").status_code == 401


def test_expired_session_cannot_access_data(authenticated, app):
    with app.state.database.sessions() as db:
        db.execute(update(AuthSession).values(expires_at=utcnow() - timedelta(seconds=1)))
        db.commit()
    assert authenticated.get("/api/v1/tasks").status_code == 401


def test_profile_update_and_password_revokes_other_sessions(authenticated, app):
    other = TestClient(app)
    login = other.post(
        "/api/v1/auth/login", json={"email": "alex@example.com", "password": PASSWORD}
    )
    assert login.status_code == 200
    result = authenticated.patch(
        "/api/v1/users/me",
        json={"username": "Alexandra", "avatar": "5", "timezone": "Asia/Kolkata"},
    )
    assert result.status_code == 200
    assert result.json()["user"]["timezone"] == "Asia/Kolkata"
    wrong = authenticated.patch(
        "/api/v1/users/me",
        json={
            "username": "Alex",
            "current_password": "wrong",
            "new_password": "new unique passphrase 2026",
        },
    )
    assert wrong.status_code == 400
    updated = authenticated.patch(
        "/api/v1/users/me",
        json={
            "username": "Alexandra",
            "current_password": PASSWORD,
            "new_password": "new unique passphrase 2026",
        },
    )
    assert updated.status_code == 200
    assert other.get("/api/v1/tasks").status_code == 401
    assert authenticated.get("/api/v1/tasks").status_code == 200
    assert (
        other.post(
            "/api/v1/auth/login", json={"email": "alex@example.com", "password": PASSWORD}
        ).status_code
        == 401
    )
    assert (
        other.post(
            "/api/v1/auth/login",
            json={"email": "alex@example.com", "password": "new unique passphrase 2026"},
        ).status_code
        == 200
    )
    other.close()


def test_delete_account_cascades_records_and_requires_reauthentication(authenticated, app):
    authenticated.post("/api/v1/tasks", json={"title": "Private task"})
    result = authenticated.request("DELETE", "/api/v1/users/me", json={"current_password": "wrong"})
    assert result.status_code == 400
    assert (
        authenticated.request(
            "DELETE", "/api/v1/users/me", json={"current_password": PASSWORD}
        ).status_code
        == 204
    )
    with app.state.database.sessions() as db:
        assert db.scalar(select(User)) is None
        assert db.scalar(select(Task)) is None
        assert db.scalar(select(AuthSession)) is None


def test_demo_accounts_are_private(client, app):
    first = client.post("/api/v1/auth/demo").json()
    other = TestClient(app)
    second = other.post("/api/v1/auth/demo").json()
    assert first["user"]["id"] != second["user"]["id"]
    assert first["user"]["is_demo"] is True
    assert "password" not in first
    tasks = client.get("/api/v1/tasks").json()["items"]
    others = other.get("/api/v1/tasks").json()["items"]
    assert set(item["id"] for item in tasks).isdisjoint(item["id"] for item in others)
    other.close()


def test_demo_can_be_disabled(client, app):
    app.state.settings.allow_demo_login = False
    assert client.post("/api/v1/auth/demo").status_code == 404


def test_auth_rate_limit(client, app):
    app.state.settings.auth_rate_limit = 2
    for _ in range(2):
        assert (
            client.post(
                "/api/v1/auth/login", json={"email": "alex@example.com", "password": "wrong"}
            ).status_code
            == 401
        )
    result = client.post(
        "/api/v1/auth/login", json={"email": "alex@example.com", "password": "wrong"}
    )
    assert result.status_code == 429
    assert int(result.headers["retry-after"]) > 0


def test_expired_session_can_still_sign_out(authenticated, app):
    with app.state.database.sessions() as db:
        db.execute(update(AuthSession).values(expires_at=utcnow() - timedelta(hours=1)))
        db.commit()
    result = authenticated.post("/api/v1/auth/logout")
    assert result.status_code == 204
    assert "Max-Age=0" in result.headers["set-cookie"]
    assert authenticated.post("/api/v1/auth/logout").status_code == 204
