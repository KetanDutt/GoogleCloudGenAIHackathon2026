from services.bigquery_client import insert_reminder, get_reminders
from typing import List, Dict, Any

def save_reminder(user_id: str, task: str, urgency: str, suggestion: str) -> bool:
    """Saves a reminder for the user to BigQuery."""
    return insert_reminder(user_id, task, urgency, suggestion)

def fetch_reminders(user_id: str) -> List[Dict[str, Any]]:
    """Fetches reminders for the user from BigQuery."""
    return get_reminders(user_id)
