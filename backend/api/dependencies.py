import hmac
from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.db.models import AuthSession, User, utcnow
from backend.services.auth_service import csrf_token, token_hash


def get_db(request: Request) -> Iterator[Session]:
    yield from request.app.state.database.session()


DB = Annotated[Session, Depends(get_db)]


def current_user(request: Request, db: DB) -> User:
    token = request.cookies.get(request.app.state.settings.cookie_name, "")
    if not token or len(token) > 256:
        raise HTTPException(401, "Please sign in to continue.")
    user = db.scalar(
        select(User)
        .join(AuthSession)
        .where(AuthSession.token_hash == token_hash(token), AuthSession.expires_at > utcnow())
    )
    if user is None:
        raise HTTPException(401, "Your session has expired. Please sign in again.")
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        supplied = request.headers.get("X-CSRF-Token", "")
        if not hmac.compare_digest(supplied.encode(), csrf_token(token).encode()):
            raise HTTPException(403, "Invalid security token. Refresh the page and try again.")
    return user


CurrentUser = Annotated[User, Depends(current_user)]


def auth_limit(request: Request, email: str = ""):
    settings = request.app.state.settings
    peer = request.client.host if request.client else "unknown"
    request.app.state.limiter.hit(f"auth-ip:{peer}", settings.auth_rate_limit)
    if email:
        request.app.state.limiter.hit(f"auth-email:{email}", settings.auth_rate_limit)
