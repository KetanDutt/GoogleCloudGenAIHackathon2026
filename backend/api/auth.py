import hmac

from fastapi import APIRouter, HTTPException, Request, Response
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError

from backend.api.dependencies import DB, CurrentUser, auth_limit
from backend.db.models import AuthSession, User
from backend.models.schemas import (
    DeleteAccount,
    Login,
    ProfileUpdate,
    Register,
    SessionResponse,
    UserResponse,
)
from backend.services.auth_service import (
    clear_cookie,
    csrf_token,
    get_password_hash,
    issue_session,
    token_hash,
    verify_password,
)
from backend.services.demo import create_demo_user

router = APIRouter(tags=["Account"])


@router.post("/auth/register", response_model=SessionResponse, status_code=201)
def register(payload: Register, request: Request, response: Response, db: DB):
    auth_limit(request, payload.email)
    user = User(
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        username=payload.username,
        avatar=payload.avatar,
        timezone=payload.timezone,
    )
    db.add(user)
    try:
        db.flush()  # A database UNIQUE constraint also covers concurrent signups.
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "An account with this email already exists.") from exc
    return issue_session(db, user, response, request.app.state.settings)


@router.post("/auth/login", response_model=SessionResponse)
def login(payload: Login, request: Request, response: Response, db: DB):
    auth_limit(request, payload.email)
    user = db.scalar(select(User).where(User.email == payload.email))
    if not verify_password(payload.password, user.hashed_password if user else None):
        raise HTTPException(401, "Incorrect email or password.")
    return issue_session(db, user, response, request.app.state.settings)


@router.get("/auth/session", response_model=SessionResponse)
def session_info(request: Request, user: CurrentUser):
    return SessionResponse(
        user=UserResponse.model_validate(user),
        csrf_token=csrf_token(request.cookies[request.app.state.settings.cookie_name]),
    )


@router.post("/auth/logout", status_code=204)
def logout(request: Request, response: Response, db: DB):
    settings = request.app.state.settings
    token = request.cookies.get(settings.cookie_name, "")
    if token:
        expected = csrf_token(token)
        if not hmac.compare_digest(
            request.headers.get("X-CSRF-Token", "").encode(), expected.encode()
        ):
            raise HTTPException(403, "Invalid security token. Refresh the page and try again.")
        db.execute(delete(AuthSession).where(AuthSession.token_hash == token_hash(token)))
        db.commit()
    clear_cookie(response, settings)


@router.post("/auth/demo", response_model=SessionResponse, status_code=201)
def demo(request: Request, response: Response, db: DB):
    settings = request.app.state.settings
    if not settings.allow_demo_login or settings.environment == "production":
        raise HTTPException(404, "Not found")
    auth_limit(request)
    user = create_demo_user(db)
    return issue_session(db, user, response, settings)


@router.get("/users/me", response_model=UserResponse)
def profile(user: CurrentUser):
    return user


@router.patch("/users/me", response_model=SessionResponse)
def update_profile(
    payload: ProfileUpdate, request: Request, response: Response, db: DB, user: CurrentUser
):
    settings = request.app.state.settings
    if payload.new_password:
        auth_limit(request, user.email)
        if user.is_demo:
            raise HTTPException(
                403, "Demo accounts cannot change passwords. Create your own account instead."
            )
        if not verify_password(payload.current_password, user.hashed_password):
            raise HTTPException(400, "Current password is incorrect.")
        user.hashed_password = get_password_hash(payload.new_password)
        db.execute(delete(AuthSession).where(AuthSession.user_id == user.id))
    user.username = payload.username
    user.avatar = payload.avatar
    user.timezone = payload.timezone
    if payload.new_password:
        return issue_session(db, user, response, settings)
    db.commit()
    return SessionResponse(
        user=UserResponse.model_validate(user),
        csrf_token=csrf_token(request.cookies[settings.cookie_name]),
    )


@router.delete("/users/me", status_code=204)
def delete_account(
    payload: DeleteAccount, request: Request, response: Response, db: DB, user: CurrentUser
):
    auth_limit(request, user.email)
    if not user.is_demo and not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(400, "Current password is incorrect.")
    db.delete(user)  # All owned records and sessions cascade in the database.
    db.commit()
    clear_cookie(response, request.app.state.settings)
