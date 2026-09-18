"""Two bounded model calls at most: classify, then a specialized structured proposal."""

import threading

from backend.agents.calendar import schedule_task
from backend.agents.notes import summarize_and_extract
from backend.agents.orchestrator import route_user_input
from backend.agents.planner import generate_tasks
from backend.agents.reminder import assess_urgency
from backend.models.schemas import Proposal
from backend.services.vertex_client import AIUnavailable, VertexClient


class Workflow:
    def __init__(self, client: VertexClient):
        self.client = client
        self.slots = threading.BoundedSemaphore(4)

    def propose(self, text: str, timezone: str, model: str):
        if self.client.settings.ai_mode == "disabled":
            raise AIUnavailable(
                "The assistant is disabled. You can still manage your workspace manually."
            )
        if not self.slots.acquire(blocking=False):
            raise AIUnavailable("The assistant is busy. Please try again shortly.")
        try:
            intent = route_user_input(self.client, text, timezone, model)
            agents = {
                "planner": generate_tasks,
                "notes": summarize_and_extract,
                "calendar": schedule_task,
                "reminder": assess_urgency,
            }
            if intent in agents:
                proposal = agents[intent](self.client, text, timezone, model)
            else:
                proposal = Proposal(
                    message="I can help turn a goal into tasks, save or summarize notes, suggest calendar events, and organize reminders. Tell me what you would like to work on. I will always ask you to review before saving."
                )
            # Revalidate even when the provider returns a Pydantic instance.
            proposal = Proposal.model_validate(proposal.model_dump())
            trace = [
                {"step": "Orchestrator", "details": f"Routed to {intent}."},
                {
                    "step": "Demo template"
                    if self.client.settings.ai_mode == "demo"
                    else "Specialist agent",
                    "details": "Deterministic local example; no AI call."
                    if self.client.settings.ai_mode == "demo"
                    else f"Generated a structured {intent} proposal.",
                },
                {
                    "step": "Validation",
                    "details": f"Validated {proposal.action_count} proposed item(s).",
                },
                {
                    "step": "Review",
                    "details": "Waiting for your confirmation."
                    if proposal.action_count
                    else "No workspace changes proposed.",
                },
            ]
            return intent, proposal, trace
        finally:
            self.slots.release()
