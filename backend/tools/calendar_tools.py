from typing import List, Dict, Any
from services.bigquery_client import insert_event, get_events

def schedule_event(user_id: str, title: str, start_time: str, end_time: str) -> bool:
    """Schedules an event for the user in BigQuery."""
    return insert_event(user_id, title, start_time, end_time)

def fetch_events(user_id: str) -> List[Dict[str, Any]]:
    """Fetches events for the user from BigQuery."""
    return get_events(user_id)
