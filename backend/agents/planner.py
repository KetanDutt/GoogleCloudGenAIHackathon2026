import re

from pydantic import Field

from backend.agents.agent_utils import agent_prompt
from backend.models.schemas import Proposal, Schema, TaskCreate


class TaskPlan(Schema):
    message: str = Field(min_length=1, max_length=3000)
    tasks: list[TaskCreate] = Field(max_length=8)


def generate_tasks(client, text: str, timezone: str, model: str) -> Proposal:
    if client.settings.ai_mode == "demo":
        goal = re.sub(r"^(add|create|save)\s+(a\s+)?task\s*:?\s*", "", text, flags=re.I).strip()
        if not goal:
            return Proposal(
                message="What would you like to get done? Add a task title and I can prepare it for review."
            )
        explicit_task = re.match(r"^(add|create|save)\s+(a\s+)?task\b", text, re.I)
        if not explicit_task and re.search(r"\b(plan|break down)\b", goal, re.I):
            titles = [
                f"Define the next step: {goal[:150]}",
                "Set aside a focused work session",
                "Review progress and choose the next action",
            ]
        else:
            titles = [goal[:200]]
        return Proposal(
            message="Here is a demo task template for you to review. Dates are left unset rather than guessed. Nothing is saved until you confirm.",
            tasks=[TaskCreate(title=title) for title in titles],
        )
    result = client.generate(
        agent_prompt(
            "Planner Agent",
            "Propose 1–8 concise actionable tasks. For an explicit single-task request, return one task only. Only assign a due date when the user specifies one; otherwise use null. Do not automatically create calendar events.",
            text,
            timezone,
        ),
        TaskPlan,
        model,
    )
    return Proposal(message=result.message, tasks=result.tasks)
