"""Transactional workspace models; analytics never stores authentication data."""

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.types import TypeDecorator


def utcnow() -> datetime:
    return datetime.now(UTC)


def new_id() -> str:
    return str(uuid4())


class UTCDateTime(TypeDecorator):
    """SQLite drops offsets; restore UTC on reads, preserve it in PostgreSQL."""

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is not None:
            if value.tzinfo is None:
                raise ValueError("A timezone-aware datetime is required")
            return value.astimezone(UTC)
        return value

    def process_result_value(self, value, dialect):
        if value is not None:
            return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)
        return value


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    hashed_password: Mapped[str] = mapped_column(Text)
    username: Mapped[str] = mapped_column(String(60))
    avatar: Mapped[str] = mapped_column(String(2), default="1")
    timezone: Mapped[str] = mapped_column(String(64), default="UTC")
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class AuthSession(Base):
    __tablename__ = "auth_sessions"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime, index=True)


class WorkspaceRecord:
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    version: Mapped[int] = mapped_column(Integer, default=1)


class Task(WorkspaceRecord, Base):
    __tablename__ = "tasks"
    __table_args__ = (
        Index("ix_tasks_owner_status_due", "user_id", "status", "due_at"),
        Index("ix_tasks_owner_created", "user_id", "created_at"),
        CheckConstraint("status IN ('pending', 'completed')"),
        CheckConstraint("priority IN ('low', 'medium', 'high')"),
    )
    title: Mapped[str] = mapped_column(String(200))
    due_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    status: Mapped[str] = mapped_column(String(12), default="pending")
    priority: Mapped[str] = mapped_column(String(6), default="medium")


class Note(WorkspaceRecord, Base):
    __tablename__ = "notes"
    __table_args__ = (Index("ix_notes_owner_created", "user_id", "created_at"),)
    title: Mapped[str] = mapped_column(String(200))
    content: Mapped[str] = mapped_column(Text)
    summary: Mapped[str | None] = mapped_column(Text)
    action_items: Mapped[list[str]] = mapped_column(JSON, default=list)


class Event(WorkspaceRecord, Base):
    __tablename__ = "events"
    __table_args__ = (
        Index("ix_events_owner_start", "user_id", "start_time"),
        CheckConstraint("end_time > start_time", name="event_positive_duration"),
    )
    title: Mapped[str] = mapped_column(String(200))
    start_time: Mapped[datetime] = mapped_column(UTCDateTime)
    end_time: Mapped[datetime] = mapped_column(UTCDateTime)
    description: Mapped[str] = mapped_column(Text, default="")


class Reminder(WorkspaceRecord, Base):
    __tablename__ = "reminders"
    __table_args__ = (
        Index("ix_reminders_owner_status_due", "user_id", "status", "due_at"),
        CheckConstraint("status IN ('pending', 'completed')"),
        CheckConstraint("urgency IN ('low', 'medium', 'high')"),
    )
    title: Mapped[str] = mapped_column(String(200))
    due_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    urgency: Mapped[str] = mapped_column(String(6), default="medium")
    suggestion: Mapped[str] = mapped_column(String(500), default="")
    status: Mapped[str] = mapped_column(String(12), default="pending")


class ChatRun(WorkspaceRecord, Base):
    __tablename__ = "chat_runs"
    __table_args__ = (
        UniqueConstraint("user_id", "request_id", name="uq_chat_owner_request"),
        Index("ix_chat_owner_created", "user_id", "created_at"),
        CheckConstraint("status IN ('pending', 'applied', 'discarded', 'info')"),
    )
    request_id: Mapped[str] = mapped_column(String(36))
    user_input: Mapped[str] = mapped_column(Text)
    intent: Mapped[str] = mapped_column(String(12))
    mode: Mapped[str] = mapped_column(String(12))
    model: Mapped[str | None] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(12))
    proposal: Mapped[dict] = mapped_column(JSON)
    trace: Mapped[list] = mapped_column(JSON, default=list)
    applied_ids: Mapped[dict] = mapped_column(JSON, default=dict)
