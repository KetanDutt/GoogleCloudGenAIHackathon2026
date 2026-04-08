from google.cloud import bigquery
from config.settings import settings
import logging
from typing import List, Dict, Any
from google.api_core.exceptions import GoogleAPIError

logger = logging.getLogger(__name__)

bq_status = "disconnected"

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
    global bq_status
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
            bigquery.SchemaField("status", "STRING", mode="NULLABLE", default_value_expression="'pending'"),
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

        # Schema for reminders
        reminder_schema = [
            bigquery.SchemaField("user_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("task", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("urgency", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("suggestion", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("created_at", "TIMESTAMP", mode="NULLABLE", default_value_expression="CURRENT_TIMESTAMP()"),
        ]
        reminder_table = bigquery.Table(f"{dataset_id}.reminders", schema=reminder_schema)
        client.create_table(reminder_table, exists_ok=True)

        # Schema for users
        user_schema = [
            bigquery.SchemaField("email", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("hashed_password", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("username", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("avatar", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("created_at", "TIMESTAMP", mode="NULLABLE", default_value_expression="CURRENT_TIMESTAMP()"),
        ]
        user_table = bigquery.Table(f"{dataset_id}.users", schema=user_schema)
        client.create_table(user_table, exists_ok=True)

        bq_status = "connected"
    except Exception as e:
        # Simplify error output if running locally without GCP configured
        if "has not enabled BigQuery" in str(e) or "credentials" in str(e).lower():
            logger.warning("BigQuery is not enabled or configured for this project. Running in mock mode.")
        else:
            logger.error(f"Error ensuring tables exist: {e}")

# Call it safely
_ensure_tables_exist()

def get_connection_status() -> str:
    """Returns the connection status of BigQuery."""
    return bq_status

def insert_task(user_id: str, task_name: str, deadline: str = None) -> bool:
    if not client:
        logger.warning(f"Mock insert_task: {user_id}, {task_name}, {deadline}")
        import datetime
        MOCK_TASKS.append({"user_id": user_id, "task_name": task_name, "deadline": deadline, "status": "pending", "created_at": datetime.datetime.now().isoformat()})
        return True

    table_ref = f"{dataset_id}.tasks"
    rows_to_insert = [
        {"user_id": user_id, "task_name": task_name, "deadline": deadline, "status": "pending"}
    ]
    try:
        errors = client.insert_rows_json(table_ref, rows_to_insert)
        return not errors
    except GoogleAPIError as e:
        logger.error(f"Failed to insert task: {e}")
        return False

def get_tasks(user_id: str) -> List[Dict[str, Any]]:
    if not client:
        return sorted([t for t in MOCK_TASKS if t["user_id"] == user_id], key=lambda x: x.get("created_at", ""), reverse=True)

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
        if "has not enabled BigQuery" in str(e) or "credentials" in str(e).lower():
            # Suppress noisy expected local error
            return []
        if "Unrecognized name: created_at" in str(e):
            logger.warning("Falling back to query without 'created_at' for tasks.")
            fallback_query = f"""
                SELECT * FROM `{dataset_id}.tasks`
                WHERE user_id = @user_id
            """
            try:
                query_job = client.query(fallback_query, job_config=job_config)
                results = query_job.result()
                return [dict(row) for row in results]
            except Exception as e_fallback:
                logger.error(f"Failed to get tasks with fallback: {e_fallback}", exc_info=True)
                return []
        logger.error(f"Failed to get tasks: {e}", exc_info=True)
        return []

def update_task_status(user_id: str, task_name: str, status: str) -> bool:
    if not client:
        logger.warning(f"Mock update_task_status: {user_id}, {task_name} -> {status}")
        for t in MOCK_TASKS:
            if t["user_id"] == user_id and t["task_name"] == task_name:
                t["status"] = status
        return True

    query = f"""
        UPDATE `{dataset_id}.tasks`
        SET status = @status
        WHERE user_id = @user_id AND task_name = @task_name
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("status", "STRING", status),
            bigquery.ScalarQueryParameter("user_id", "STRING", user_id),
            bigquery.ScalarQueryParameter("task_name", "STRING", task_name),
        ]
    )

    try:
        query_job = client.query(query, job_config=job_config)
        query_job.result() # Wait for completion
        return True
    except Exception as e:
        logger.error(f"Failed to update task status: {e}", exc_info=True)
        return False

def insert_note(user_id: str, content: str, summary: str = None, action_items: str = None) -> bool:
    if not client:
        logger.warning(f"Mock insert_note: {user_id}, {content}")
        import datetime
        MOCK_NOTES.append({"user_id": user_id, "content": content, "summary": summary, "action_items": action_items, "created_at": datetime.datetime.now().isoformat()})
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
        return sorted([n for n in MOCK_NOTES if n["user_id"] == user_id], key=lambda x: x.get("created_at", ""), reverse=True)

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
        if "has not enabled BigQuery" in str(e) or "credentials" in str(e).lower():
             # Suppress noisy expected local error
             return []
        if "Unrecognized name: created_at" in str(e):
            logger.warning("Falling back to query without 'created_at' for notes.")
            fallback_query = f"""
                SELECT * FROM `{dataset_id}.notes`
                WHERE user_id = @user_id
            """
            try:
                query_job = client.query(fallback_query, job_config=job_config)
                results = query_job.result()
                return [dict(row) for row in results]
            except Exception as e_fallback:
                logger.error(f"Failed to get notes with fallback: {e_fallback}", exc_info=True)
                return []
        logger.error(f"Failed to get notes: {e}", exc_info=True)
        return []

def get_events(user_id: str) -> List[Dict[str, Any]]:
    if not client:
        return sorted([e for e in MOCK_EVENTS if e["user_id"] == user_id], key=lambda x: x.get("created_at", ""), reverse=True)

    query = f"""
        SELECT * FROM `{dataset_id}.events`
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
        if "has not enabled BigQuery" in str(e) or "credentials" in str(e).lower():
             return []
        if "Unrecognized name: created_at" in str(e):
            logger.warning("Falling back to query without 'created_at' for events.")
            fallback_query = f"""
                SELECT * FROM `{dataset_id}.events`
                WHERE user_id = @user_id
            """
            try:
                query_job = client.query(fallback_query, job_config=job_config)
                results = query_job.result()
                return [dict(row) for row in results]
            except Exception as e_fallback:
                logger.error(f"Failed to get events with fallback: {e_fallback}", exc_info=True)
                return []
        logger.error(f"Failed to get events: {e}", exc_info=True)
        return []

def insert_event(user_id: str, title: str, start_time: str, end_time: str) -> bool:
    if not client:
        logger.warning(f"Mock insert_event: {user_id}, {title}, {start_time}-{end_time}")
        import datetime
        MOCK_EVENTS.append({"user_id": user_id, "title": title, "start_time": start_time, "end_time": end_time, "created_at": datetime.datetime.now().isoformat()})
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

def insert_reminder(user_id: str, task: str, urgency: str, suggestion: str) -> bool:
    if not client:
        logger.warning(f"Mock insert_reminder: {user_id}, {task}, {urgency}")
        import datetime
        MOCK_REMINDERS.append({"user_id": user_id, "task": task, "urgency": urgency, "suggestion": suggestion, "created_at": datetime.datetime.now().isoformat()})
        return True

    table_ref = f"{dataset_id}.reminders"
    rows_to_insert = [
        {
            "user_id": user_id,
            "task": task,
            "urgency": urgency,
            "suggestion": suggestion
        }
    ]
    try:
        errors = client.insert_rows_json(table_ref, rows_to_insert)
        return not errors
    except GoogleAPIError as e:
        logger.error(f"Failed to insert reminder: {e}")
        return False

def get_reminders(user_id: str) -> List[Dict[str, Any]]:
    if not client:
        return sorted([r for r in MOCK_REMINDERS if r["user_id"] == user_id], key=lambda x: x.get("created_at", ""), reverse=True)

    query = f"""
        SELECT * FROM `{dataset_id}.reminders`
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
        if "has not enabled BigQuery" in str(e) or "credentials" in str(e).lower():
             return []
        if "Unrecognized name: created_at" in str(e):
            logger.warning("Falling back to query without 'created_at' for reminders.")
            fallback_query = f"""
                SELECT * FROM `{dataset_id}.reminders`
                WHERE user_id = @user_id
            """
            try:
                query_job = client.query(fallback_query, job_config=job_config)
                results = query_job.result()
                return [dict(row) for row in results]
            except Exception as e_fallback:
                logger.error(f"Failed to get reminders with fallback: {e_fallback}", exc_info=True)
                return []
        logger.error(f"Failed to get reminders: {e}", exc_info=True)
        return []

# In-memory store for mock data when BigQuery is not available
MOCK_USERS = {}
MOCK_TASKS = []
MOCK_NOTES = []
MOCK_EVENTS = []
MOCK_REMINDERS = []

def create_user(email: str, hashed_password: str, username: str, avatar: str) -> bool:
    """Inserts a new user into BigQuery. Returns True if successful, False if email already exists or error."""
    if not client:
        logger.warning(f"Mock create_user: {email}")
        if email in MOCK_USERS:
            return False
        MOCK_USERS[email] = {
            "email": email,
            "hashed_password": hashed_password,
            "username": username,
            "avatar": avatar
        }
        return True

    # Check if user already exists
    existing_user = get_user_by_email(email)
    if existing_user:
        return False

    # Use DML INSERT to ensure it's immediately available
    query = f"""
        INSERT INTO `{dataset_id}.users` (email, hashed_password, username, avatar)
        VALUES (@email, @hashed_password, @username, @avatar)
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("email", "STRING", email),
            bigquery.ScalarQueryParameter("hashed_password", "STRING", hashed_password),
            bigquery.ScalarQueryParameter("username", "STRING", username),
            bigquery.ScalarQueryParameter("avatar", "STRING", avatar),
        ]
    )

    try:
        query_job = client.query(query, job_config=job_config)
        query_job.result()
        return True
    except Exception as e:
        logger.error(f"Failed to create user: {e}", exc_info=True)
        return False

def get_user_by_email(email: str) -> Dict[str, Any] | None:
    """Fetches a user by email. Returns None if not found."""
    if not client:
        logger.warning(f"Mock get_user_by_email: {email}")
        return MOCK_USERS.get(email)

    query = f"""
        SELECT * FROM `{dataset_id}.users`
        WHERE email = @email
        LIMIT 1
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[bigquery.ScalarQueryParameter("email", "STRING", email)]
    )

    try:
        query_job = client.query(query, job_config=job_config)
        results = list(query_job.result())
        if results:
            return dict(results[0])
        return None
    except Exception as e:
        if "has not enabled BigQuery" in str(e) or "credentials" in str(e).lower():
            return None
        logger.error(f"Failed to get user by email: {e}", exc_info=True)
        return None

def update_user_password(email: str, new_hashed_password: str) -> bool:
    """Updates a user's password."""
    if not client:
        logger.warning(f"Mock update_user_password for: {email}")
        if email in MOCK_USERS:
            MOCK_USERS[email]["hashed_password"] = new_hashed_password
            return True
        return False

    query = f"""
        UPDATE `{dataset_id}.users`
        SET hashed_password = @hashed_password
        WHERE email = @email
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("hashed_password", "STRING", new_hashed_password),
            bigquery.ScalarQueryParameter("email", "STRING", email),
        ]
    )

    try:
        query_job = client.query(query, job_config=job_config)
        query_job.result()
        return True
    except Exception as e:
        logger.error(f"Failed to update user password: {e}", exc_info=True)
        return False
