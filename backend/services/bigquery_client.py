from google.cloud import bigquery
from config.settings import settings
import logging
from typing import List, Dict, Any
from google.api_core.exceptions import GoogleAPIError

logger = logging.getLogger(__name__)

# Initialize BigQuery Client
try:
    client = bigquery.Client(project=settings.PROJECT_ID)
    dataset_id = f"{settings.PROJECT_ID}.{settings.BIGQUERY_DATASET}"
except Exception as e:
    logger.error(f"Failed to initialize BigQuery client: {e}")
    client = None
    dataset_id = ""

def _ensure_tables_exist():
    """Ensure that necessary tables exist in BigQuery."""
    if not client:
        return

    try:
        # Create dataset if it doesn't exist
        dataset = bigquery.Dataset(dataset_id)
        dataset.location = settings.LOCATION
        client.create_dataset(dataset, exists_ok=True)

        # Schema for tasks
        task_schema = [
            bigquery.SchemaField("user_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("task_name", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("deadline", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("created_at", "TIMESTAMP", mode="NULLABLE", default_value_expression="CURRENT_TIMESTAMP()"),
        ]
        task_table = bigquery.Table(f"{dataset_id}.tasks", schema=task_schema)
        client.create_table(task_table, exists_ok=True)

        # Schema for notes
        note_schema = [
            bigquery.SchemaField("user_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("content", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("summary", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("action_items", "STRING", mode="NULLABLE"), # Stores JSON string
            bigquery.SchemaField("created_at", "TIMESTAMP", mode="NULLABLE", default_value_expression="CURRENT_TIMESTAMP()"),
        ]
        note_table = bigquery.Table(f"{dataset_id}.notes", schema=note_schema)
        client.create_table(note_table, exists_ok=True)

        # Schema for events
        event_schema = [
            bigquery.SchemaField("user_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("title", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("start_time", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("end_time", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("created_at", "TIMESTAMP", mode="NULLABLE", default_value_expression="CURRENT_TIMESTAMP()"),
        ]
        event_table = bigquery.Table(f"{dataset_id}.events", schema=event_schema)
        client.create_table(event_table, exists_ok=True)
    except Exception as e:
        logger.error(f"Error ensuring tables exist: {e}")

# Call it safely
_ensure_tables_exist()

def insert_task(user_id: str, task_name: str, deadline: str = None) -> bool:
    if not client:
        logger.warning(f"Mock insert_task: {user_id}, {task_name}, {deadline}")
        return True

    table_ref = f"{dataset_id}.tasks"
    rows_to_insert = [
        {"user_id": user_id, "task_name": task_name, "deadline": deadline}
    ]
    try:
        errors = client.insert_rows_json(table_ref, rows_to_insert)
        return not errors
    except GoogleAPIError as e:
        logger.error(f"Failed to insert task: {e}")
        return False

def get_tasks(user_id: str) -> List[Dict[str, Any]]:
    if not client:
        return [{"user_id": user_id, "task_name": "Mock Task", "deadline": "2024-01-01"}]

    query = f"""
        SELECT * FROM `{dataset_id}.tasks`
        WHERE user_id = @user_id
        ORDER BY created_at DESC
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[bigquery.ScalarQueryParameter("user_id", "STRING", user_id)]
    )

    try:
        query_job = client.query(query, job_config=job_config)
        results = query_job.result()
        return [dict(row) for row in results]
    except Exception as e:
        logger.error(f"Failed to get tasks: {e}")
        return []

def insert_note(user_id: str, content: str, summary: str = None, action_items: str = None) -> bool:
    if not client:
        logger.warning(f"Mock insert_note: {user_id}, {content}")
        return True

    table_ref = f"{dataset_id}.notes"
    rows_to_insert = [
        {
            "user_id": user_id,
            "content": content,
            "summary": summary,
            "action_items": action_items
        }
    ]
    try:
        errors = client.insert_rows_json(table_ref, rows_to_insert)
        return not errors
    except GoogleAPIError as e:
        logger.error(f"Failed to insert note: {e}")
        return False

def get_notes(user_id: str) -> List[Dict[str, Any]]:
    if not client:
        return [{"user_id": user_id, "content": "Mock Note"}]

    query = f"""
        SELECT * FROM `{dataset_id}.notes`
        WHERE user_id = @user_id
        ORDER BY created_at DESC
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[bigquery.ScalarQueryParameter("user_id", "STRING", user_id)]
    )

    try:
        query_job = client.query(query, job_config=job_config)
        results = query_job.result()
        return [dict(row) for row in results]
    except Exception as e:
        logger.error(f"Failed to get notes: {e}")
        return []

def insert_event(user_id: str, title: str, start_time: str, end_time: str) -> bool:
    if not client:
        logger.warning(f"Mock insert_event: {user_id}, {title}, {start_time}-{end_time}")
        return True

    table_ref = f"{dataset_id}.events"
    rows_to_insert = [
        {
            "user_id": user_id,
            "title": title,
            "start_time": start_time,
            "end_time": end_time
        }
    ]
    try:
        errors = client.insert_rows_json(table_ref, rows_to_insert)
        return not errors
    except GoogleAPIError as e:
        logger.error(f"Failed to insert event: {e}")
        return False
