"""Tenant-scoped, paginated CRUD with optimistic concurrency control."""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from pydantic import AwareDatetime
from sqlalchemy import case, delete, func, or_, select, update

from backend.api.dependencies import DB, CurrentUser
from backend.db.models import Event, Note, Reminder, Task, utcnow
from backend.models.schemas import (
    DashboardResponse,
    EventCreate,
    EventResponse,
    EventUpdate,
    NoteCreate,
    NoteResponse,
    NoteUpdate,
    Page,
    Priority,
    ReminderCreate,
    ReminderResponse,
    ReminderUpdate,
    Status,
    TaskCreate,
    TaskResponse,
    TaskUpdate,
)

router = APIRouter(tags=["Workspace"])
Limit = Annotated[int, Query(ge=1, le=100)]
Offset = Annotated[int, Query(ge=0, le=100_000)]
Search = Annotated[str, Query(max_length=200)]
Version = Annotated[int, Query(ge=1)]


def page(db, query, limit, offset):
    total = db.scalar(select(func.count()).select_from(query.order_by(None).subquery()))
    return {
        "items": db.scalars(query.limit(limit).offset(offset)).all(),
        "total": total,
        "limit": limit,
        "offset": offset,
    }


def owned(db, model, record_id, user_id):
    row = db.scalar(select(model).where(model.id == record_id, model.user_id == user_id))
    if row is None:
        raise HTTPException(404, "This item was not found.")
    return row


def create(db, model, user_id, payload):
    row = model(user_id=user_id, **payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def patch(db, model, record_id, user_id, payload, extra=None):
    row = owned(db, model, record_id, user_id)
    values = payload.model_dump(exclude_unset=True, exclude={"version"})
    values.update(extra or {})
    result = db.execute(
        update(model)
        .where(
            model.id == record_id,
            model.user_id == user_id,
            model.version == payload.version,
        )
        .values(**values, version=model.version + 1, updated_at=utcnow())
    )
    if result.rowcount != 1:
        db.rollback()
        raise HTTPException(409, "This item changed in another session. Refresh and try again.")
    db.commit()
    db.refresh(row)
    return row


def remove(db, model, record_id, user_id, version):
    owned(db, model, record_id, user_id)
    result = db.execute(
        delete(model).where(
            model.id == record_id,
            model.user_id == user_id,
            model.version == version,
        )
    )
    if result.rowcount != 1:
        db.rollback()
        raise HTTPException(409, "This item changed in another session. Refresh and try again.")
    db.commit()


@router.get("/tasks", response_model=Page[TaskResponse])
def tasks(
    db: DB,
    user: CurrentUser,
    limit: Limit = 20,
    offset: Offset = 0,
    q: Search = "",
    status: Status | None = None,
    priority: Priority | None = None,
    overdue: bool = False,
):
    query = select(Task).where(Task.user_id == user.id)
    if q:
        query = query.where(Task.title.icontains(q, autoescape=True))
    if status:
        query = query.where(Task.status == status)
    if priority:
        query = query.where(Task.priority == priority)
    if overdue:
        query = query.where(Task.status == "pending", Task.due_at < utcnow())
    query = query.order_by(
        Task.status.desc(), Task.due_at.asc().nullslast(), Task.created_at.desc(), Task.id
    )
    return page(db, query, limit, offset)


@router.post("/tasks", response_model=TaskResponse, status_code=201)
def add_task(payload: TaskCreate, db: DB, user: CurrentUser):
    return create(db, Task, user.id, payload)


@router.patch("/tasks/{record_id}", response_model=TaskResponse)
def edit_task(record_id: str, payload: TaskUpdate, db: DB, user: CurrentUser):
    return patch(db, Task, record_id, user.id, payload)


@router.delete("/tasks/{record_id}", status_code=204)
def delete_task(record_id: str, version: Version, db: DB, user: CurrentUser):
    remove(db, Task, record_id, user.id, version)


@router.get("/notes", response_model=Page[NoteResponse])
def notes(db: DB, user: CurrentUser, limit: Limit = 20, offset: Offset = 0, q: Search = ""):
    query = select(Note).where(Note.user_id == user.id)
    if q:
        query = query.where(
            or_(
                Note.title.icontains(q, autoescape=True), Note.content.icontains(q, autoescape=True)
            )
        )
    return page(db, query.order_by(Note.updated_at.desc(), Note.id), limit, offset)


@router.post("/notes", response_model=NoteResponse, status_code=201)
def add_note(payload: NoteCreate, db: DB, user: CurrentUser):
    return create(db, Note, user.id, payload)


@router.patch("/notes/{record_id}", response_model=NoteResponse)
def edit_note(record_id: str, payload: NoteUpdate, db: DB, user: CurrentUser):
    # Derived text must not describe an older version of the source note.
    extra = {"summary": None, "action_items": []} if "content" in payload.model_fields_set else {}
    return patch(db, Note, record_id, user.id, payload, extra)


@router.delete("/notes/{record_id}", status_code=204)
def delete_note(record_id: str, version: Version, db: DB, user: CurrentUser):
    remove(db, Note, record_id, user.id, version)


@router.get("/events", response_model=Page[EventResponse])
def events(
    db: DB,
    user: CurrentUser,
    limit: Limit = 100,
    offset: Offset = 0,
    from_time: AwareDatetime | None = None,
    to_time: AwareDatetime | None = None,
):
    if from_time and to_time and from_time >= to_time:
        raise HTTPException(422, "The calendar range must end after it starts.")
    query = select(Event).where(Event.user_id == user.id)
    if from_time:
        query = query.where(Event.end_time > from_time)
    if to_time:
        query = query.where(Event.start_time < to_time)
    return page(db, query.order_by(Event.start_time, Event.id), limit, offset)


@router.post("/events", response_model=EventResponse, status_code=201)
def add_event(payload: EventCreate, db: DB, user: CurrentUser):
    return create(db, Event, user.id, payload)


@router.patch("/events/{record_id}", response_model=EventResponse)
def edit_event(record_id: str, payload: EventUpdate, db: DB, user: CurrentUser):
    return patch(db, Event, record_id, user.id, payload)


@router.delete("/events/{record_id}", status_code=204)
def delete_event(record_id: str, version: Version, db: DB, user: CurrentUser):
    remove(db, Event, record_id, user.id, version)


@router.get("/reminders", response_model=Page[ReminderResponse])
def reminders(
    db: DB,
    user: CurrentUser,
    limit: Limit = 20,
    offset: Offset = 0,
    q: Search = "",
    status: Status | None = None,
):
    query = select(Reminder).where(Reminder.user_id == user.id)
    if q:
        query = query.where(Reminder.title.icontains(q, autoescape=True))
    if status:
        query = query.where(Reminder.status == status)
    return page(
        db,
        query.order_by(
            Reminder.status.desc(),
            Reminder.due_at.asc().nullslast(),
            Reminder.created_at.desc(),
            Reminder.id,
        ),
        limit,
        offset,
    )


@router.post("/reminders", response_model=ReminderResponse, status_code=201)
def add_reminder(payload: ReminderCreate, db: DB, user: CurrentUser):
    return create(db, Reminder, user.id, payload)


@router.patch("/reminders/{record_id}", response_model=ReminderResponse)
def edit_reminder(record_id: str, payload: ReminderUpdate, db: DB, user: CurrentUser):
    return patch(db, Reminder, record_id, user.id, payload)


@router.delete("/reminders/{record_id}", status_code=204)
def delete_reminder(record_id: str, version: Version, db: DB, user: CurrentUser):
    remove(db, Reminder, record_id, user.id, version)


@router.get("/dashboard", response_model=DashboardResponse)
def dashboard(db: DB, user: CurrentUser):
    now = utcnow()
    task_counts = db.execute(
        select(
            func.count(Task.id),
            func.sum(case((Task.status == "completed", 1), else_=0)),
            func.sum(case(((Task.status == "pending") & (Task.due_at < now), 1), else_=0)),
        ).where(Task.user_id == user.id)
    ).one()
    total, completed, overdue_count = (int(value or 0) for value in task_counts)
    upcoming = db.scalars(
        select(Event)
        .where(Event.user_id == user.id, Event.end_time > now)
        .order_by(Event.start_time)
        .limit(4)
    ).all()
    focus = db.scalars(
        select(Task)
        .where(Task.user_id == user.id, Task.status == "pending")
        .order_by(Task.due_at.asc().nullslast(), Task.created_at.desc())
        .limit(5)
    ).all()
    recent_notes = db.scalars(
        select(Note).where(Note.user_id == user.id).order_by(Note.updated_at.desc()).limit(2)
    ).all()
    count_notes = db.scalar(select(func.count()).select_from(Note).where(Note.user_id == user.id))
    count_reminders = db.scalar(
        select(func.count())
        .select_from(Reminder)
        .where(Reminder.user_id == user.id, Reminder.status == "pending")
    )
    return {
        "counts": {
            "tasks": total,
            "completed": completed,
            "pending": total - completed,
            "overdue": overdue_count,
            "notes": count_notes,
            "reminders": count_reminders,
        },
        "focus_tasks": [TaskResponse.model_validate(row) for row in focus],
        "upcoming_events": [EventResponse.model_validate(row) for row in upcoming],
        "recent_notes": [NoteResponse.model_validate(row) for row in recent_notes],
    }
