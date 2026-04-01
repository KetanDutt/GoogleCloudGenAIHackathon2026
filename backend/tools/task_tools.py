from services.bigquery_client import insert_task, get_tasks
from typing import List, Dict, Any

def add_task(user_id: str, task_name: str, deadline: str = None) -> bool:
    """Adds a task for the user to BigQuery."""
    return insert_task(user_id, task_name, deadline)

def list_tasks(user_id: str) -> List[Dict[str, Any]]:
    """Lists tasks for the user from BigQuery."""
    return get_tasks(user_id)
