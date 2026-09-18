from pydantic import Field

from backend.agents.agent_utils import agent_prompt
from backend.agents.calendar import demo_datetime
from backend.models.schemas import Proposal, ReminderCreate, Schema


class ReminderPlan(Schema):
    message: str = Field(min_length=1, max_length=3000)
    reminders: list[ReminderCreate] = Field(max_length=4)


def assess_urgency(client, text: str, timezone: str, model: str) -> Proposal:
    if client.settings.ai_mode == "demo":
        due = demo_datetime(text, timezone)
        return Proposal(
            message="Review this demo reminder. Reminders appear in your workspace only; email, push notifications, and background delivery are not implemented.",
            reminders=[
                ReminderCreate(
                    title=text[:200],
                    due_at=due,
                    suggestion="Choose an exact due time in Reminders."
                    if due is None
                    else "Review this reminder in your workspace.",
                )
            ],
        )
    result = client.generate(
        agent_prompt(
            "Reminder Agent",
            "Propose up to four in-app reminders. Set due_at only if an exact date/time can be inferred safely. Urgency must be low, medium, or high. Explain that these are in-app records: no email, push, or background notifications are sent.",
            text,
            timezone,
        ),
        ReminderPlan,
        model,
    )
    return Proposal(message=result.message, reminders=result.reminders)
