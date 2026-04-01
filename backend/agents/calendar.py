from services.vertex_client import generate_text
import re
import datetime

def schedule_task(task: str) -> dict:
    """
    Suggests a realistic start and end time (datetime string format) for a given task.
    """
    now = datetime.datetime.now().isoformat()

    prompt = f"""
    You are a Calendar Agent. Suggest a realistic start and end time for this task:
    Task: "{task}"
    Current Date and Time: {now}

    Provide your response exactly in this format:
    START: <start_datetime_iso_format>
    END: <end_datetime_iso_format>

    Make reasonable assumptions about the task duration (e.g., 30 mins, 1 hour).
    """

    response = generate_text(prompt).strip()

    start_match = re.search(r'START:\s*([^\n]+)', response)
    end_match = re.search(r'END:\s*([^\n]+)', response)

    start_time = start_match.group(1).strip() if start_match else ""
    end_time = end_match.group(1).strip() if end_match else ""

    # Simple fallback
    if not start_time or not end_time:
        base_time = datetime.datetime.now() + datetime.timedelta(hours=1)
        start_time = base_time.isoformat()
        end_time = (base_time + datetime.timedelta(hours=1)).isoformat()

    return {"start_time": start_time, "end_time": end_time}
