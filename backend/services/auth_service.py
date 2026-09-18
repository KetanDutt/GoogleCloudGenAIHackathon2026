"""Opaque, revocable sessions. Neither session tokens nor passwords enter logs."""

import hashlib
import hmac
import secrets
from datetime import timedelta

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import Response
from sqlalchemy import delete
from sqlalchemy.orm import Session

from backend.config.settings import Settings
from backend.db.models import AuthSession, User, utcnow
from backend.models.schemas import SessionResponse, UserResponse

_password_hasher = PasswordHasher(time_cost=2, memory_cost=19456, parallelism=1)
# Equal-cost verification when the email does not exist.
_DUMMY_HASH = _password_hasher.hash(secrets.token_urlsafe(32))


def get_password_hash(password: str) -> str:
    return _password_hasher.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    try:
        valid = _password_hasher.verify(password_hash or _DUMMY_HASH, password)
        return valid and password_hash is not None
    except (VerificationError, InvalidHashError):
        return False


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def csrf_token(token: str) -> str:
    return hmac.new(token.encode(), b"aiops-csrf-v1", hashlib.sha256).hexdigest()


def issue_session(
    db: Session, user: User, response: Response, settings: Settings
) -> SessionResponse:
    token = secrets.token_urlsafe(32)
    db.execute(
        delete(AuthSession).where(
            AuthSession.user_id == user.id, AuthSession.expires_at <= utcnow()
        )
    )
    db.add(
        AuthSession(
            token_hash=token_hash(token),
            user_id=user.id,
            expires_at=utcnow() + timedelta(hours=settings.session_hours),
        )
    )
    db.commit()
    response.set_cookie(
        settings.cookie_name,
        token,
        max_age=settings.session_hours * 3600,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        path="/",
    )
    if settings.cookie_partitioned:
        # Python <3.14 SimpleCookie lacks this attribute. CHIPS supports HTTPS previews.
        response.headers["set-cookie"] += "; Partitioned"
    return SessionResponse(user=UserResponse.model_validate(user), csrf_token=csrf_token(token))


def clear_cookie(response: Response, settings: Settings):
    response.delete_cookie(
        settings.cookie_name,
        path="/",
        secure=settings.cookie_secure,
        httponly=True,
        samesite=settings.cookie_samesite,
    )

    if settings.cookie_partitioned:
        response.headers["set-cookie"] += "; Partitioned"
