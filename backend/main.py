import json
import asyncio
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from typing import List, Dict, Any
from datetime import timedelta

from models.schemas import ChatRequest, ChatResponse, Task, Note, Event, TaskCompleteRequest, UserCreate, UserLogin, TokenResponse, UserResponse
from services.auth_service import get_password_hash, verify_password, create_access_token, verify_token, ACCESS_TOKEN_EXPIRE_MINUTES
from services.bigquery_client import create_user, get_user_by_email, update_user_password
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

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

def get_current_user_email(token: str = Depends(oauth2_scheme)):
    payload = verify_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload["sub"]

import re

def is_valid_password(password: str) -> bool:
    if len(password) < 8 or len(password) > 16:
        return False
    if not re.search(r"\d", password):
        return False
    if not re.search(r"[A-Z]", password):
        return False
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        return False
    return True

@app.get("/users/me", response_model=UserResponse)
async def get_current_user_profile(current_user_email: str = Depends(get_current_user_email)):
    db_user = await asyncio.to_thread(get_user_by_email, current_user_email)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "email": db_user["email"],
        "username": db_user.get("username", db_user["email"].split("@")[0]),
        "avatar": db_user.get("avatar", "1")
    }

@app.post("/register", response_model=TokenResponse)
async def register(user: UserCreate):
    if not is_valid_password(user.password):
        raise HTTPException(
            status_code=400,
            detail="Password must be 8-16 characters and contain a number, a capital letter, and a special character."
        )

    existing_user = await asyncio.to_thread(get_user_by_email, user.email)
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_password = get_password_hash(user.password)
    success = await asyncio.to_thread(create_user, user.email, hashed_password, user.username, user.avatar)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to create user")

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/login", response_model=TokenResponse)
async def login(user: UserLogin):
    db_user = await asyncio.to_thread(get_user_by_email, user.email)
    if not db_user or not verify_password(user.password, db_user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

async def handle_request(request: ChatRequest, current_user: str) -> ChatResponse:
    """
    Main workflow engine. Routes user input and processes it through specialized agents asynchronously.
    """
    user_input = request.user_input
    user_id = current_user

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
async def chat_endpoint(request: ChatRequest, current_user: str = Depends(get_current_user_email)):
    """Chat endpoint to process user input."""
    return await handle_request(request, current_user)

@app.get("/tasks", response_model=List[Dict[str, Any]])
async def get_tasks_endpoint(current_user: str = Depends(get_current_user_email)):
    """Returns user tasks."""
    tasks = await asyncio.to_thread(list_tasks, current_user)
    return tasks

@app.put("/tasks/complete")
async def complete_task_endpoint(request: TaskCompleteRequest, current_user: str = Depends(get_current_user_email)):
    """Marks a user task as complete."""
    success = await asyncio.to_thread(complete_task_status, current_user, request.task_name)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to complete task")
    return {"message": "Task completed successfully"}

@app.get("/notes", response_model=List[Dict[str, Any]])
async def get_notes_endpoint(current_user: str = Depends(get_current_user_email)):
    """Returns user notes."""
    notes = await asyncio.to_thread(fetch_notes, current_user)
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
