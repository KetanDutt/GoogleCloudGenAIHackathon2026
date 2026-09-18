"""Regenerate the credential-free API reference without starting services."""

import json
from pathlib import Path

from backend.config.settings import Settings
from backend.main import create_app

if __name__ == "__main__":
    app = create_app(
        Settings(
            environment="test",
            database_url="sqlite:///:memory:",
            ai_mode="demo",
            allow_demo_login=True,
            cookie_secure=False,
            cookie_samesite="lax",
            cookie_partitioned=False,
            _env_file=None,
        )
    )
    target = Path(__file__).resolve().parents[2] / "docs" / "openapi.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(
        json.dumps(app.openapi(), indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    app.state.database.engine.dispose()
    print(f"Wrote {target.relative_to(target.parents[1])}")
