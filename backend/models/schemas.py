from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class ChatRequest(BaseModel):
    user_input: str
    user_id: str = "default_user"

class ChatResponse(BaseModel):
    intent: str
    response: Any

class Task(BaseModel):
    id: Optional[str] = None
    user_id: str
    task_name: str
    deadline: Optional[str] = None
    created_at: Optional[str] = None

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
