from datetime import timedelta

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError

from backend.api.dependencies import DB, CurrentUser
from backend.api.resources import Limit, Offset, owned, page
from backend.db.models import ChatRun, Event, Note, Reminder, Task, utcnow
from backend.models.schemas import ChatRequest, ChatResponse, Page, Proposal

router = APIRouter(tags=["Assistant"])


@router.get("/chat", response_model=Page[ChatResponse])
def history(db: DB, user: CurrentUser, limit: Limit = 20, offset: Offset = 0):
    return page(
        db,
        select(ChatRun)
        .where(ChatRun.user_id == user.id)
        .order_by(ChatRun.created_at.desc(), ChatRun.id),
        limit,
        offset,
    )


@router.post("/chat", response_model=ChatResponse, status_code=201)
def chat(payload: ChatRequest, request: Request, db: DB, user: CurrentUser):
    settings = request.app.state.settings
    model = payload.model_name or settings.default_model
    if model not in settings.models:
        raise HTTPException(
            422, "This model is not enabled. Choose a model from the assistant settings."
        )
    request_id = str(payload.request_id)
    existing_query = select(ChatRun).where(
        ChatRun.user_id == user.id, ChatRun.request_id == request_id
    )
    existing = db.scalar(existing_query)
    if existing:
        if existing.user_input != payload.user_input or (
            existing.model and existing.model != model
        ):
            raise HTTPException(409, "This request ID belongs to a different message.")
        return existing
    request.app.state.limiter.hit(f"chat:{user.id}", settings.chat_rate_limit)
    # Release the read transaction/connection while a remote model is working.
    user_id, timezone = user.id, user.timezone
    db.commit()
    intent, proposal, trace = request.app.state.workflow.propose(
        payload.user_input, timezone, model
    )
    run = ChatRun(
        user_id=user_id,
        request_id=request_id,
        user_input=payload.user_input,
        intent=intent,
        mode=settings.ai_mode,
        model=model if settings.ai_mode == "vertex" else None,
        status="pending" if proposal.action_count else "info",
        proposal=proposal.model_dump(mode="json"),
        trace=trace,
    )
    db.add(run)
    try:
        db.commit()
    except IntegrityError:
        # Concurrent transport retries may generate twice, but create only one proposal.
        db.rollback()
        existing = db.scalar(existing_query)
        if (
            existing
            and existing.user_input == payload.user_input
            and (not existing.model or existing.model == model)
        ):
            return existing
        raise HTTPException(409, "This request ID belongs to a different message.") from None
    return run


@router.post("/chat/{run_id}/apply", response_model=ChatResponse)
def apply_proposal(run_id: str, db: DB, user: CurrentUser):
    run = owned(db, ChatRun, run_id, user.id)
    if run.status == "applied":
        return run
    if run.created_at < utcnow() - timedelta(hours=24):
        raise HTTPException(409, "This proposal has expired. Ask the assistant for a fresh one.")
    proposal = Proposal.model_validate(run.proposal)
    result = db.execute(
        update(ChatRun)
        .where(
            ChatRun.id == run.id,
            ChatRun.user_id == user.id,
            ChatRun.status == "pending",
        )
        .values(status="applied", updated_at=utcnow(), version=ChatRun.version + 1)
    )
    if result.rowcount != 1:
        db.rollback()
        db.refresh(run)
        if run.status == "applied":
            return run
        raise HTTPException(409, "This proposal is no longer awaiting review.")
    ids = {}
    for name, model in [
        ("tasks", Task),
        ("notes", Note),
        ("events", Event),
        ("reminders", Reminder),
    ]:
        ids[name] = []
        for data in getattr(proposal, name):
            item = model(user_id=user.id, **data.model_dump())
            db.add(item)
            db.flush()
            ids[name].append(item.id)
    run.applied_ids = ids
    # One commit makes claiming the proposal + all its records atomic and idempotent.
    db.commit()
    db.refresh(run)
    return run


@router.post("/chat/{run_id}/discard", response_model=ChatResponse)
def discard_proposal(run_id: str, db: DB, user: CurrentUser):
    run = owned(db, ChatRun, run_id, user.id)
    if run.status == "discarded":
        return run
    result = db.execute(
        update(ChatRun)
        .where(
            ChatRun.id == run.id,
            ChatRun.user_id == user.id,
            ChatRun.status == "pending",
        )
        .values(status="discarded", updated_at=utcnow(), version=ChatRun.version + 1)
    )
    if result.rowcount != 1:
        db.rollback()
        raise HTTPException(409, "Only proposals awaiting review can be discarded.")
    db.commit()
    db.refresh(run)
    return run


@router.delete("/chat", status_code=204)
def clear_history(db: DB, user: CurrentUser):
    db.execute(delete(ChatRun).where(ChatRun.user_id == user.id))
    db.commit()
