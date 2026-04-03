from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class ChatRequest(BaseModel):
    user_input: str

class AgentTraceStep(BaseModel):
    step: str
    details: str

class ChatResponse(BaseModel):
    intent: str
    response: Any
    trace: Optional[List[AgentTraceStep]] = None

class UserCreate(BaseModel):
    email: str
    password: str
    username: str
    avatar: str

class UserResponse(BaseModel):
    email: str
    username: str
    avatar: str

class UserLogin(BaseModel):
    email: str
    password: str

class ForgotPasswordRequest(BaseModel):
    email: str
    new_password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str

class Task(BaseModel):
    id: Optional[str] = None
    user_id: str
    task_name: str
    deadline: Optional[str] = None
    status: Optional[str] = "pending"
    created_at: Optional[str] = None

class TaskCompleteRequest(BaseModel):
    task_name: str

class Note(BaseModel):
    id: Optional[str] = None
    user_id: str
    content: str
    summary: Optional[str] = None
    action_items: Optional[List[str]] = None
    created_at: Optional[str] = None

class Event(BaseModel):
    id: Optional[str] = None
    user_id: str
    title: str
    start_time: str
    end_time: str
    created_at: Optional[str] = None
