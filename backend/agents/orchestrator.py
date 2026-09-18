import re

from backend.agents.agent_utils import agent_prompt
from backend.models.schemas import Intent, Schema


class IntentResult(Schema):
    intent: Intent


def route_user_input(client, text: str, timezone: str, model: str) -> str:
    if client.settings.ai_mode == "demo":
        value = text.lower()
        for intent, pattern in [
            ("reminder", r"\b(remind|reminder|reminders)\b"),
            ("notes", r"\b(note|notes|summarize|summary)\b"),
            ("calendar", r"\b(schedule|calendar|appointment|event|meeting)\b"),
            ("planner", r"\b(plan|task|tasks|todo|goal|project)\b"),
        ]:
            if re.search(pattern, value):
                return intent
        return "general"
    prompt = agent_prompt(
        "Orchestrator",
        "Classify exactly one intent: planner for tasks/goals, notes for saving or summarizing text, calendar for events, reminder for reminders, general for other requests. Summarizing a meeting is notes, not calendar.",
        text,
        timezone,
    )
    return client.generate(prompt, IntentResult, model).intent
