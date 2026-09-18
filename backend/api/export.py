import json
from contextlib import closing

from fastapi import APIRouter, Request, Response
from sqlalchemy import select

from backend.api.dependencies import DB, CurrentUser
from backend.db.models import ChatRun, Event, Note, Reminder, Task, utcnow
from backend.models.schemas import (
    ChatResponse,
    EventResponse,
    NoteResponse,
    ReminderResponse,
    TaskResponse,
    UserResponse,
)

router = APIRouter(tags=["Account"])
EXPORT_LIMIT = 10_000
EXPORT_BYTE_LIMIT = 8 * 1024 * 1024


@router.get("/users/me/export")
def export_data(request: Request, db: DB, user: CurrentUser):
    request.app.state.limiter.hit(f"export:{user.id}", 2)
    used_bytes = 4096  # reserve ample room for bounded user/format/truncation metadata
    result = {
        "format_version": 2,
        "exported_at": utcnow().isoformat(),
        "user": UserResponse.model_validate(user).model_dump(mode="json"),
        "truncated_collections": [],
        "limit_per_collection": EXPORT_LIMIT,
        "max_bytes": EXPORT_BYTE_LIMIT,
    }
    for name, model, schema in [
        ("tasks", Task, TaskResponse),
        ("notes", Note, NoteResponse),
        ("events", Event, EventResponse),
        ("reminders", Reminder, ReminderResponse),
        ("chat", ChatRun, ChatResponse),
    ]:
        result[name] = []
        # Bounded driver batches avoid materializing a user's complete history in memory.
        query = (
            select(model)
            .where(model.user_id == user.id)
            .order_by(model.created_at, model.id)
            .limit(EXPORT_LIMIT + 1)
            .execution_options(yield_per=50)
        )
        with closing(db.scalars(query)) as rows:
            for row in rows:
                item = schema.model_validate(row).model_dump(mode="json")
                size = len(json.dumps(item, ensure_ascii=False, separators=(",", ":")).encode()) + 1
                if len(result[name]) >= EXPORT_LIMIT or used_bytes + size > EXPORT_BYTE_LIMIT:
                    result["truncated_collections"].append(name)
                    break
                result[name].append(item)
                used_bytes += size
    return Response(
        content=json.dumps(result, ensure_ascii=False, separators=(",", ":")),
        media_type="application/json",
        headers={"Content-Disposition": 'attachment; filename="ai-ops-export.json"'},
    )
