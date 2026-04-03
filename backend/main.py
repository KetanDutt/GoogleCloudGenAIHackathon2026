import json
import asyncio
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any

from models.schemas import ChatRequest, ChatResponse, Task, Note, Event, TaskCompleteRequest
from agents.orchestrator import route_user_input
from agents.planner import generate_tasks
from agents.calendar import schedule_task
from agents.notes import summarize_and_extract
from agents.reminder import assess_urgency

from tools.task_tools import add_task, list_tasks, complete_task_status
from tools.notes_tools import save_note, fetch_notes
from tools.calendar_tools import schedule_event
from fastapi.middleware.cors import CORSMiddleware

from services.bigquery_client import get_connection_status as get_bq_status
from services.vertex_client import get_connection_status as get_vertex_status

app = FastAPI(
    title="AI Personal Operations Manager",
    description="Multi-Agent System for Managing Tasks, Notes, and Calendars",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def handle_request(request: ChatRequest) -> ChatResponse:
    """
    Main workflow engine. Routes user input and processes it through specialized agents asynchronously.
    """
    user_input = request.user_input
    user_id = request.user_id

    trace = [{"step": "User Input", "details": user_input}]
    # 1. Orchestrate
    intent = await asyncio.to_thread(route_user_input, user_input)
    trace.append({"step": "Orchestrator", "details": f"Routed to {intent} agent"})
    response_data = {}

    try:
        if intent == "planner":
            # Generate tasks
            trace.append({"step": "Agent Processing", "details": "Planner agent generating tasks..."})
            tasks = await asyncio.to_thread(generate_tasks, user_input)
            scheduled_tasks = []

            for task_name in tasks:
                # Schedule each task via calendar agent
                trace.append({"step": "Agent Processing", "details": f"Calendar agent scheduling task: {task_name}"})
                time_suggestion = await asyncio.to_thread(schedule_task, task_name)
                start_time = time_suggestion.get("start_time")
                end_time = time_suggestion.get("end_time")

                # Store in BigQuery
                trace.append({"step": "Tool Execution", "details": "Adding task and event to database"})
                await asyncio.to_thread(add_task, user_id, task_name, start_time)
                await asyncio.to_thread(schedule_event, user_id, task_name, start_time, end_time)

                scheduled_tasks.append({
                    "task": task_name,
                    "scheduled_start": start_time,
                    "scheduled_end": end_time
                })

            trace.append({"step": "Database Sync", "details": f"Saved {len(scheduled_tasks)} scheduled tasks"})
            response_data = {"tasks_created": scheduled_tasks}

        elif intent == "notes":
            # Summarize and extract
            trace.append({"step": "Agent Processing", "details": "Notes agent summarizing and extracting action items..."})
            extracted = await asyncio.to_thread(summarize_and_extract, user_input)
            summary = extracted.get("summary")
            action_items = extracted.get("action_items", [])

            action_items_str = json.dumps(action_items)

            # Save notes
            trace.append({"step": "Tool Execution", "details": "Saving note to database"})
            await asyncio.to_thread(save_note, user_id, user_input, summary, action_items_str)
            trace.append({"step": "Database Sync", "details": "Note saved successfully"})

            response_data = {
                "summary": summary,
                "action_items": action_items
            }

        elif intent == "calendar":
            # Schedule a single event
            trace.append({"step": "Agent Processing", "details": "Calendar agent suggesting times..."})
            time_suggestion = await asyncio.to_thread(schedule_task, user_input)
            start_time = time_suggestion.get("start_time")
            end_time = time_suggestion.get("end_time")

            trace.append({"step": "Tool Execution", "details": "Saving event to database"})
            await asyncio.to_thread(schedule_event, user_id, user_input, start_time, end_time)
            trace.append({"step": "Database Sync", "details": "Event saved successfully"})

            response_data = {
                "event_scheduled": user_input,
                "start_time": start_time,
                "end_time": end_time
            }

        elif intent == "reminder":
            trace.append({"step": "Agent Processing", "details": "Reminder agent assessing urgency..."})
            urgency_data = await asyncio.to_thread(assess_urgency, user_input)
            trace.append({"step": "Database Sync", "details": "No database actions needed for reminders."})
            response_data = {
                "reminder_set_for": user_input,
                "urgency": urgency_data.get("urgency_level"),
                "suggestion": urgency_data.get("reminder_suggestion")
            }
        else:
            intent = "unknown"
            trace.append({"step": "Orchestrator", "details": "Could not classify intent."})
            response_data = {"message": "Could not determine intent."}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return ChatResponse(intent=intent, response=response_data, trace=trace)

@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    """Chat endpoint to process user input."""
    return await handle_request(request)

@app.get("/tasks", response_model=List[Dict[str, Any]])
async def get_tasks_endpoint(user_id: str = "default_user"):
    """Returns user tasks."""
    tasks = await asyncio.to_thread(list_tasks, user_id)
    return tasks

@app.put("/tasks/complete")
async def complete_task_endpoint(request: TaskCompleteRequest):
    """Marks a user task as complete."""
    success = await asyncio.to_thread(complete_task_status, request.user_id, request.task_name)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to complete task")
    return {"message": "Task completed successfully"}

@app.get("/notes", response_model=List[Dict[str, Any]])
async def get_notes_endpoint(user_id: str = "default_user"):
    """Returns user notes."""
    notes = await asyncio.to_thread(fetch_notes, user_id)
    return notes

@app.get("/health")
async def health_check():
    """Health check for deployment."""
    bq_status = await asyncio.to_thread(get_bq_status)
    vertex_status = await asyncio.to_thread(get_vertex_status)
    return {
        "status": "ok",
        "bigquery": bq_status,
        "vertex_ai": vertex_status
    }
