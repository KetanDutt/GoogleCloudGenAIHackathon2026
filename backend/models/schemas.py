"""All writes (including model output) pass through the same bounded schemas."""

from datetime import datetime
from typing import Annotated, Generic, Literal, Self, TypeVar
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Content = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=8000)]
Username = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=60)]
Password = Annotated[str, Field(min_length=12, max_length=128)]
Priority = Literal["low", "medium", "high"]
Status = Literal["pending", "completed"]
Intent = Literal["planner", "notes", "calendar", "reminder", "general"]
Avatar = Literal["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]


class Schema(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)


class AccountFields(Schema):
    username: Username
    avatar: Avatar = "1"
    timezone: str = Field(default="UTC", max_length=64)

    @field_validator("timezone")
    @classmethod
    def valid_timezone(cls, value):
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError) as exc:
            raise ValueError("Use an IANA timezone such as Europe/London") from exc
        return value


class Login(Schema):
    email: EmailStr = Field(max_length=254)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email", mode="before")
    @classmethod
    def normalized_email(cls, value):
        return value.strip().lower() if isinstance(value, str) else value


class Register(Login, AccountFields):
    password: Password


class UserResponse(AccountFields):
    id: str
    email: str
    is_demo: bool
    created_at: datetime


class SessionResponse(Schema):
    user: UserResponse
    csrf_token: str


class ProfileUpdate(AccountFields):
    current_password: str = Field(default="", max_length=128)
    new_password: Password | None = None


class DeleteAccount(Schema):
    current_password: str = Field(default="", max_length=128)


class Record(Schema):
    id: str
    created_at: datetime
    updated_at: datetime
    version: int


class TaskCreate(Schema):
    title: Title
    due_at: AwareDatetime | None = None
    priority: Priority = "medium"


class TaskResponse(TaskCreate, Record):
    status: Status


class Patch(Schema):
    version: int = Field(ge=1)

    @model_validator(mode="after")
    def valid_patch(self) -> Self:
        fields = self.model_fields_set - {"version"}
        if not fields:
            raise ValueError("Provide at least one field to update")
        for name in fields - {"due_at"}:
            if getattr(self, name) is None:
                raise ValueError(f"{name} cannot be null")
        return self


class TaskUpdate(Patch):
    title: Title | None = None
    due_at: AwareDatetime | None = None
    priority: Priority | None = None
    status: Status | None = None


class NoteCreate(Schema):
    title: Title
    content: Content


class NoteResponse(NoteCreate, Record):
    summary: str | None
    action_items: list[str]


class NoteUpdate(Patch):
    title: Title | None = None
    content: Content | None = None


class EventCreate(Schema):
    title: Title
    start_time: AwareDatetime
    end_time: AwareDatetime
    description: str = Field(default="", max_length=2000)

    @model_validator(mode="after")
    def ordered_dates(self) -> Self:
        if self.end_time <= self.start_time:
            raise ValueError("Event end must be after its start")
        return self


class EventResponse(EventCreate, Record):
    pass


class EventUpdate(EventCreate):
    version: int = Field(ge=1)


class ReminderCreate(Schema):
    title: Title
    due_at: AwareDatetime | None = None
    urgency: Priority = "medium"
    suggestion: str = Field(default="", max_length=500)


class ReminderResponse(ReminderCreate, Record):
    status: Status


class ReminderUpdate(Patch):
    title: Title | None = None
    due_at: AwareDatetime | None = None
    urgency: Priority | None = None
    suggestion: str | None = Field(default=None, max_length=500)
    status: Status | None = None


T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    limit: int
    offset: int


class ChatRequest(Schema):
    user_input: Content
    request_id: UUID
    model_name: str | None = Field(default=None, max_length=100)


class AgentTraceStep(Schema):
    step: str
    details: str


class SuggestedNote(NoteCreate):
    summary: str | None = Field(default=None, max_length=3000)
    action_items: list[Title] = Field(default_factory=list, max_length=8)


class Proposal(Schema):
    message: str = Field(min_length=1, max_length=3000)
    tasks: list[TaskCreate] = Field(default_factory=list, max_length=8)
    notes: list[SuggestedNote] = Field(default_factory=list, max_length=1)
    events: list[EventCreate] = Field(default_factory=list, max_length=4)
    reminders: list[ReminderCreate] = Field(default_factory=list, max_length=4)

    @property
    def action_count(self) -> int:
        return len(self.tasks) + len(self.notes) + len(self.events) + len(self.reminders)

    @model_validator(mode="after")
    def bounded_actions(self) -> Self:
        if self.action_count > 8:
            raise ValueError("A proposal can contain at most eight actions")
        return self


class ChatResponse(Record):
    user_input: str
    request_id: str
    intent: Intent
    mode: Literal["demo", "vertex"]
    model: str | None
    status: Literal["pending", "applied", "discarded", "info"]
    proposal: Proposal
    trace: list[AgentTraceStep]
    applied_ids: dict[str, list[str]]


class DashboardCounts(Schema):
    tasks: int
    completed: int
    pending: int
    overdue: int
    notes: int
    reminders: int


class DashboardResponse(Schema):
    counts: DashboardCounts
    focus_tasks: list[TaskResponse]
    upcoming_events: list[EventResponse]
    recent_notes: list[NoteResponse]


class SystemStatusResponse(Schema):
    version: str
    ai_mode: Literal["demo", "vertex", "disabled"]
    ai_status: Literal[
        "configured", "demo", "disabled", "last_request_succeeded", "last_request_failed"
    ]
    demo_login: bool
    models: list[str]
    default_model: str
    storage: Literal["sqlite", "postgresql"]
    reminder_delivery: Literal["in_app_only"]
