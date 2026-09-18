import re
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from pydantic import Field

from backend.agents.agent_utils import agent_prompt
from backend.models.schemas import EventCreate, Proposal, Schema


class CalendarPlan(Schema):
    message: str = Field(min_length=1, max_length=3000)
    events: list[EventCreate] = Field(max_length=4)


def demo_datetime(text: str, timezone: str) -> datetime | None:
    """Deliberately small demo grammar: today/tomorrow at an explicit clock time."""
    value = text.lower()
    match = re.search(r"\b(today|tomorrow)\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b", value)
    if not match:
        return None
    day, hours, minutes, meridiem = match.groups()
    hours, minutes = int(hours), int(minutes or 0)
    if minutes > 59 or (meridiem and not 1 <= hours <= 12) or (not meridiem and hours > 23):
        return None
    if meridiem:
        hours = hours % 12 + (12 if meridiem == "pm" else 0)
    now = datetime.now(ZoneInfo(timezone))
    date = now + timedelta(days=1 if day == "tomorrow" else 0)
    return date.replace(hour=hours, minute=minutes, second=0, microsecond=0)


def schedule_task(client, text: str, timezone: str, model: str) -> Proposal:
    if client.settings.ai_mode == "demo":
        start = demo_datetime(text, timezone)
        if start is None:
            return Proposal(
                message="In demo mode, include a time like ‘tomorrow at 10am’, or add an event directly in Calendar. No date has been guessed and nothing was saved."
            )
        return Proposal(
            message="A demo calendar proposal with a one-hour duration. Review the date, timezone, and duration before saving. This does not sync to Google Calendar.",
            events=[
                EventCreate(title=text[:200], start_time=start, end_time=start + timedelta(hours=1))
            ],
        )
    result = client.generate(
        agent_prompt(
            "Calendar Agent",
            "Propose up to four events. Require a clear date and start time; ask a question if either is missing. If duration is omitted, suggest 30 minutes and disclose that assumption in message. End must be after start. These are local workspace events, not Google Calendar bookings.",
            text,
            timezone,
        ),
        CalendarPlan,
        model,
    )
    return Proposal(message=result.message, events=result.events)
