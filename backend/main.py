import json
import asyncio
import warnings
from fastapi import FastAPI, HTTPException, Depends, status

warnings.filterwarnings('ignore', category=UserWarning, module='vertexai')
from fastapi.security import OAuth2PasswordBearer
from typing import List, Dict, Any
from datetime import timedelta

from models.schemas import ChatRequest, ChatResponse, TaskCompleteRequest, UserCreate, UserLogin, TokenResponse, UserResponse
from services.auth_service import get_password_hash, verify_password, create_access_token, verify_token, ACCESS_TOKEN_EXPIRE_MINUTES
from services.bigquery_client import create_user, get_user_by_email
from services.workflow import process_chat_workflow

from tools.task_tools import list_tasks, complete_task_status
from tools.notes_tools import fetch_notes
from tools.reminder_tools import fetch_reminders
from tools.calendar_tools import fetch_events
from fastapi.middleware.cors import CORSMiddleware

from services.bigquery_client import get_connection_status as get_bq_status
from services.vertex_client import get_connection_status as get_vertex_status, get_available_models
from config.settings import settings

app = FastAPI(
    title="AI Personal Operations Manager",
    description="Multi-Agent System for Managing Tasks, Notes, and Calendars",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()],
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

@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest, current_user: str = Depends(get_current_user_email)):
    """Chat endpoint to process user input."""
    return await process_chat_workflow(request, current_user)

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

@app.get("/reminders", response_model=List[Dict[str, Any]])
async def get_reminders_endpoint(current_user: str = Depends(get_current_user_email)):
    """Returns user reminders."""
    reminders = await asyncio.to_thread(fetch_reminders, current_user)
    return reminders

@app.get("/events", response_model=List[Dict[str, Any]])
async def get_events_endpoint(current_user: str = Depends(get_current_user_email)):
    """Returns user calendar events."""
    events = await asyncio.to_thread(fetch_events, current_user)
    return events

@app.get("/models")
async def get_models_endpoint():
    """Returns available Vertex AI models."""
    return {"models": get_available_models()}

@app.get("/ready")
async def readiness():
    # Check if all critical services are initialized
    return {"ready": True}

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
