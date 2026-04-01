from services.bigquery_client import insert_event

def schedule_event(user_id: str, title: str, start_time: str, end_time: str) -> bool:
    """Schedules an event for the user in BigQuery."""
    return insert_event(user_id, title, start_time, end_time)
