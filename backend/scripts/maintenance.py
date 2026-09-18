"""Dry-run-first session cleanup and optional expired demo-account retention."""

import argparse
import json
from datetime import timedelta

from sqlalchemy import delete, exists, func, select

from backend.config.settings import Settings
from backend.db.database import Database
from backend.db.models import AuthSession, User, utcnow


def maintain(db, demo_hours: int | None = None, apply: bool = False) -> dict:
    now = utcnow()
    expired = AuthSession.expires_at <= now
    result = {
        "expired_sessions": db.scalar(select(func.count()).select_from(AuthSession).where(expired)),
        "inactive_demo_accounts": 0,
        "applied": apply,
    }
    demo_condition = None
    if demo_hours is not None:
        if demo_hours < 1:
            raise ValueError("Demo retention must be at least one hour")
        demo_condition = (
            User.is_demo.is_(True)
            & (User.created_at < now - timedelta(hours=demo_hours))
            & ~exists(
                select(AuthSession.token_hash).where(
                    AuthSession.user_id == User.id, AuthSession.expires_at > now
                )
            )
        )
        result["inactive_demo_accounts"] = db.scalar(
            select(func.count()).select_from(User).where(demo_condition)
        )
    if apply:
        db.execute(delete(AuthSession).where(expired))
        if demo_condition is not None:
            db.execute(delete(User).where(demo_condition))
        db.commit()
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Actually remove expired records; defaults to a read-only dry run",
    )
    parser.add_argument(
        "--demo-older-than-hours",
        type=int,
        help="Optionally remove old demo accounts with no live sessions (never regular accounts)",
    )
    args = parser.parse_args()
    database = Database(Settings())
    try:
        with database.sessions() as db:
            print(json.dumps(maintain(db, args.demo_older_than_hours, args.apply), indent=2))
    finally:
        database.engine.dispose()


if __name__ == "__main__":
    main()
