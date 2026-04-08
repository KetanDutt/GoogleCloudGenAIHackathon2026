import json
from agents.agent_utils import call_llm_with_retry

def assess_urgency(task: str, model_name: str = "gemini-2.5-flash") -> dict:
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

    def parse_reminder(response: str) -> dict:
        clean_response = response.strip()
        if clean_response.startswith("```json"):
            clean_response = clean_response.replace("```json", "", 1)
            if clean_response.endswith("```"):
                clean_response = clean_response[:-3]
        elif clean_response.startswith("```"):
            clean_response = clean_response.replace("```", "", 1)
            if clean_response.endswith("```"):
                clean_response = clean_response[:-3]

        data = json.loads(clean_response.strip())
        urgency = data.get("urgency_level", "").lower()
        suggestion = data.get("reminder_suggestion", "")

        if urgency not in ["low", "medium", "high"]:
            raise ValueError("urgency_level must be one of: low, medium, high")

        if not suggestion:
            raise ValueError("reminder_suggestion cannot be empty")

        return {"urgency_level": urgency, "reminder_suggestion": suggestion}

    return call_llm_with_retry(
        prompt=prompt,
        model_name=model_name,
        parse_func=parse_reminder,
        fallback_value={"urgency_level": "medium", "reminder_suggestion": "1 hour before"},
        clarification_prompt_template="The previous response was not valid JSON or the values were incorrect. Please return exactly the requested JSON format with urgency_level strictly as one of 'low', 'medium', or 'high'. Original request: {prompt}"
    )
