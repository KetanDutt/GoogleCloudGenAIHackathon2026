import os

import pytest
from fastapi.testclient import TestClient

from backend.config.settings import Settings
from backend.db.models import Base
from backend.main import create_app

PASSWORD = "a unique test passphrase 2026"


@pytest.fixture
def app(tmp_path):
    database_url = os.environ.get("TEST_DATABASE_URL", f"sqlite:///{tmp_path / 'test.db'}")
    if "TEST_DATABASE_URL" in os.environ:
        assert "aiops_test" in database_url, (
            "Integration tests only run against an aiops_test database"
        )
    settings = Settings(
        environment="test",
        database_url=database_url,
        ai_mode="demo",
        allow_demo_login=True,
        cookie_secure=False,
        cookie_samesite="lax",
        cookie_partitioned=False,
        auth_rate_limit=1000,
        chat_rate_limit=100,
        google_cloud_project="aiops-test",
        _env_file=None,
    )
    app = create_app(settings)
    Base.metadata.drop_all(app.state.database.engine)
    return app


@pytest.fixture
def client(app):
    with TestClient(app) as client:
        yield client


def signup(client, email="alex@example.com", username="Alex", password=PASSWORD):
    result = client.post(
        "/api/v1/auth/register", json={"email": email, "username": username, "password": password}
    )
    assert result.status_code == 201, result.text
    client.headers["X-CSRF-Token"] = result.json()["csrf_token"]
    return result.json()


@pytest.fixture
def authenticated(client):
    signup(client)
    return client


@pytest.fixture
def second_user(app, authenticated):
    with TestClient(app) as other:
        signup(other, email="sam@example.com", username="Sam")
        yield other
