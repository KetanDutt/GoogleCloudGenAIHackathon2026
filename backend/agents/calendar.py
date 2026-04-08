from agents.agent_utils import call_llm_with_retry
import re
import datetime

def schedule_task(task: str, model_name: str = "gemini-flash-lite-latest") -> dict:
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

    def parse_calendar(response: str) -> dict:
        start_match = re.search(r'START:\s*([^\n]+)', response)
        end_match = re.search(r'END:\s*([^\n]+)', response)

        start_time = start_match.group(1).strip() if start_match else ""
        end_time = end_match.group(1).strip() if end_match else ""

        if not start_time or not end_time:
            raise ValueError("Missing START or END tags in response.")

        # Validate ISO format
        datetime.datetime.fromisoformat(start_time.replace('Z', '+00:00'))
        datetime.datetime.fromisoformat(end_time.replace('Z', '+00:00'))

        return {"start_time": start_time, "end_time": end_time}

    base_time = datetime.datetime.now() + datetime.timedelta(hours=1)
    default_start = base_time.isoformat()
    default_end = (base_time + datetime.timedelta(hours=1)).isoformat()

    return call_llm_with_retry(
        prompt=prompt,
        model_name=model_name,
        parse_func=parse_calendar,
        fallback_value={"start_time": default_start, "end_time": default_end},
        clarification_prompt_template="The previous response was incorrectly formatted. Please return EXACTLY: \nSTART: <iso_time>\nEND: <iso_time>\nOriginal request: {prompt}"
    )
