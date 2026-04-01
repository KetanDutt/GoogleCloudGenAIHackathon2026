from services.vertex_client import generate_text

def assess_urgency(task: str) -> dict:
    """
    Identifies urgency and returns reminder suggestions.
    """
    prompt = f"""
    You are a Reminder Agent. Assess the urgency of the following task and suggest when to set a reminder.

    Task: "{task}"

    Return ONLY a JSON response in the following format:
    {{
        "urgency_level": "low|medium|high",
        "reminder_suggestion": "Suggested time string (e.g., '1 hour before', 'tomorrow at 9 AM')"
    }}
    """

    response = generate_text(prompt).strip()

    import json
    if response.startswith("```json"):
        response = response.replace("```json", "", 1).replace("```", "")

    try:
        data = json.loads(response.strip())
        urgency = data.get("urgency_level", "low")
        suggestion = data.get("reminder_suggestion", "1 hour before")
    except json.JSONDecodeError:
        urgency = "low"
        suggestion = "1 hour before"

    return {"urgency_level": urgency, "reminder_suggestion": suggestion}
