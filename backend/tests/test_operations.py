import asyncio
import os
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from backend.config.settings import Settings
from backend.db.database import Database
from backend.db.models import Base
from backend.services.rate_limit import RateLimiter


def test_production_configuration_fails_closed():
    base = dict(
        environment="production",
        database_url="postgresql+psycopg://user:password@host/aiops",
        cookie_secure=True,
        allow_demo_login=False,
        ai_mode="disabled",
        cors_origins="https://app.example.com",
        _env_file=None,
    )
    assert Settings(**base).cookie_name.startswith("__Host-")
    for override in [
        {"database_url": "sqlite:///:memory:"},
        {"cookie_secure": False},
        {"allow_demo_login": True},
        {"ai_mode": "demo"},
        {"cors_origins": "http://app.example.com"},
    ]:
        with pytest.raises(ValueError):
            Settings(**(base | override))


@pytest.mark.parametrize(
    "values",
    [
        {"ai_mode": "vertex", "google_cloud_project": ""},
        {"default_model": "not-allowed"},
        {"cors_origins": "*"},
        {"database_url": "mysql://host/db"},
    ],
)
def test_invalid_configuration(values):
    with pytest.raises(ValueError):
        Settings(_env_file=None, **values)


def test_readiness_reports_storage_failure(client, app, monkeypatch):
    def fail():
        raise SQLAlchemyError("private connection details")

    monkeypatch.setattr(app.state.database, "check", fail)
    result = client.get("/ready")
    assert result.status_code == 503 and result.json() == {"ready": False}
    assert client.get("/health").status_code == 200


def test_response_security_headers_and_redacted_validation(client):
    result = client.post(
        "/api/v1/auth/login", json={"email": "bad email", "password": "sensitive-password"}
    )
    assert result.status_code == 422
    assert result.headers["cache-control"] == "no-store"
    assert result.headers["x-content-type-options"] == "nosniff"
    assert result.headers["x-request-id"] == result.json()["request_id"]
    assert "sensitive-password" not in result.text


def test_body_limit_with_content_length(client):
    response = client.post("/api/v1/auth/login", content=b"x" * 70_000)
    assert response.status_code == 413


def test_body_limit_without_content_length(app):
    async def request():
        chunks = iter(
            [
                {"type": "http.request", "body": b"x" * 40_000, "more_body": True},
                {"type": "http.request", "body": b"x" * 40_000, "more_body": False},
            ]
        )
        messages = []

        async def receive():
            return next(chunks)

        async def send(message):
            messages.append(message)

        await app(
            {
                "type": "http",
                "method": "POST",
                "path": "/api/v1/auth/login",
                "query_string": b"",
                "headers": [],
                "http_version": "1.1",
                "scheme": "http",
                "server": ("testserver", 80),
                "client": ("client", 123),
            },
            receive,
            send,
        )
        assert messages[0]["status"] == 413

    asyncio.run(request())


def test_rate_limiter_has_bounded_memory():
    limiter = RateLimiter(max_keys=2)
    for index in range(20):
        limiter.hit(f"key-{index}", 1)
    assert len(limiter._buckets) == 2
    assert all("key-" not in key for key in limiter._buckets)


def test_initial_migration_and_schema_drift_check(tmp_path):
    url = os.environ.get("TEST_DATABASE_URL", f"sqlite:///{tmp_path / 'migrations.db'}")
    if "TEST_DATABASE_URL" in os.environ:
        assert "aiops_test" in url, "Migrations only test an isolated aiops_test database"
    settings = Settings(environment="test", database_url=url, _env_file=None)
    database = Database(settings)
    config = Config(str(Path(__file__).resolve().parents[2] / "alembic.ini"))
    with database.engine.begin() as connection:
        Base.metadata.drop_all(connection)
        connection.execute(text("DROP TABLE IF EXISTS alembic_version"))
        config.attributes["connection"], config.attributes["settings"] = connection, settings
        command.upgrade(config, "head")
        command.check(config)
        assert connection.scalar(text("SELECT count(*) FROM users")) == 0
        command.downgrade(config, "base")
        command.upgrade(config, "head")
        command.check(config)
        command.downgrade(config, "base")
        connection.execute(text("DROP TABLE alembic_version"))
    database.engine.dispose()


def test_openapi_documents_cookie_csrf_and_safe_validation(client):
    schema = client.get("/openapi.json").json()
    assert schema["components"]["securitySchemes"]["CookieSession"]["in"] == "cookie"
    operation = schema["paths"]["/api/v1/tasks"]["post"]
    assert operation["security"] == [{"CookieSession": []}]
    assert any(item["name"] == "X-CSRF-Token" for item in operation["parameters"])
    assert operation["responses"]["422"]["content"]["application/json"]["schema"]["$ref"].endswith(
        "SafeError"
    )
    assert "security" not in schema["paths"]["/api/v1/auth/login"]["post"]


@pytest.mark.parametrize(
    "values",
    [
        {"cookie_samesite": "none"},
        {"cookie_partitioned": True},
        {"cookie_secure": True, "cookie_partitioned": True},
        {"cors_origins": "https://*.example.com"},
        {"cors_origins": "https://username:password@example.com"},
        {"cors_origins": "https://example.com?not-an-origin"},
    ],
)
def test_insecure_or_invalid_preview_configuration_is_rejected(values):
    with pytest.raises(ValueError):
        Settings(_env_file=None, **values)


def test_cloud_run_cannot_silently_start_in_development(monkeypatch):
    monkeypatch.setenv("K_SERVICE", "a-service")
    with pytest.raises(ValueError, match="Cloud Run services must use"):
        Settings(environment="development", _env_file=None)
