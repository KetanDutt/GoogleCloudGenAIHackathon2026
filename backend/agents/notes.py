import re

from pydantic import Field

from backend.agents.agent_utils import agent_prompt
from backend.models.schemas import Proposal, Schema, SuggestedNote


class NotesPlan(Schema):
    message: str = Field(min_length=1, max_length=3000)
    notes: list[SuggestedNote] = Field(max_length=1)


def summarize_and_extract(client, text: str, timezone: str, model: str) -> Proposal:
    if client.settings.ai_mode == "demo":
        content = (
            re.sub(
                r"^(add|save|take|summarize)\s*(this\s+|a\s+)?(note|meeting)?\s*:?\s*",
                "",
                text,
                flags=re.I,
            ).strip()
            or text
        )
        return Proposal(
            message="Your text is ready to save as a note. Demo mode copies text; it does not generate an AI summary or invent action items.",
            notes=[SuggestedNote(title=content.splitlines()[0][:80], content=content)],
        )
    result = client.generate(
        agent_prompt(
            "Notes Agent",
            "Propose one note with a useful title, the original source content, a faithful short summary, and up to eight explicit action items. Do not invent assignments or deadlines. Keep action_items empty when none are present.",
            text,
            timezone,
        ),
        NotesPlan,
        model,
    )
    return Proposal(message=result.message, notes=result.notes)
