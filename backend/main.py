from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any

from models.schemas import ChatRequest, ChatResponse, Task, Note, Event
from agents.orchestrator import route_user_input
from agents.planner import generate_tasks
from agents.calendar import schedule_task
from agents.notes import summarize_and_extract
from agents.reminder import assess_urgency

from tools.task_tools import add_task, list_tasks
from tools.notes_tools import save_note, fetch_notes
from tools.calendar_tools import schedule_event

app = FastAPI(
    title="AI Personal Operations Manager",
    description="Multi-Agent System for Managing Tasks, Notes, and Calendars",
    version="1.0.0"
)

def handle_request(request: ChatRequest) -> ChatResponse:
    """
    Main workflow engine. Routes user input and processes it through specialized agents.
    """
    user_input = request.user_input
    user_id = request.user_id

    # 1. Orchestrate
    intent = route_user_input(user_input)
    response_data = {}

    try:
        if intent == "planner":
            # Generate tasks
            tasks = generate_tasks(user_input)
            scheduled_tasks = []

            for task_name in tasks:
                # Schedule each task via calendar agent
                time_suggestion = schedule_task(task_name)
                start_time = time_suggestion.get("start_time")
                end_time = time_suggestion.get("end_time")

                # Store in BigQuery
                add_task(user_id, task_name, start_time)
                schedule_event(user_id, task_name, start_time, end_time)

                scheduled_tasks.append({
                    "task": task_name,
                    "scheduled_start": start_time,
                    "scheduled_end": end_time
                })

            response_data = {"tasks_created": scheduled_tasks}

        elif intent == "notes":
            # Summarize and extract
            extracted = summarize_and_extract(user_input)
            summary = extracted.get("summary")
            action_items = extracted.get("action_items", [])

            import json
            action_items_str = json.dumps(action_items)

            # Save notes
            save_note(user_id, user_input, summary, action_items_str)

            response_data = {
                "summary": summary,
                "action_items": action_items
            }

        elif intent == "calendar":
            # Schedule a single event
            time_suggestion = schedule_task(user_input)
            start_time = time_suggestion.get("start_time")
            end_time = time_suggestion.get("end_time")

            schedule_event(user_id, user_input, start_time, end_time)

            response_data = {
                "event_scheduled": user_input,
                "start_time": start_time,
                "end_time": end_time
            }

        elif intent == "reminder":
            urgency_data = assess_urgency(user_input)
            response_data = {
                "reminder_set_for": user_input,
                "urgency": urgency_data.get("urgency_level"),
                "suggestion": urgency_data.get("reminder_suggestion")
            }
        else:
            intent = "unknown"
            response_data = {"message": "Could not determine intent."}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return ChatResponse(intent=intent, response=response_data)

@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    """Chat endpoint to process user input."""
    return handle_request(request)

@app.get("/tasks", response_model=List[Dict[str, Any]])
async def get_tasks_endpoint(user_id: str = "default_user"):
    """Returns user tasks."""
    tasks = list_tasks(user_id)
    return tasks

@app.get("/notes", response_model=List[Dict[str, Any]])
async def get_notes_endpoint(user_id: str = "default_user"):
    """Returns user notes."""
    notes = fetch_notes(user_id)
    return notes

@app.get("/health")
async def health_check():
    """Health check for deployment."""
    return {"status": "ok"}
