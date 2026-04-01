from services.bigquery_client import insert_note, get_notes
from typing import List, Dict, Any

def save_note(user_id: str, content: str, summary: str = None, action_items: str = None) -> bool:
    """Saves a note for the user to BigQuery."""
    return insert_note(user_id, content, summary, action_items)

def fetch_notes(user_id: str) -> List[Dict[str, Any]]:
    """Fetches notes for the user from BigQuery."""
    return get_notes(user_id)
