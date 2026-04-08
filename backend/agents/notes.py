import json
from agents.agent_utils import call_llm_with_retry

def summarize_and_extract(text: str, model_name: str = "gemini-2.5-flash") -> dict:
    """
    Summarizes text and extracts key action items.
    """
    prompt = f"""
    You are a Notes Agent. Your job is to summarize text and extract any clear action items.

    Text: "{text}"

    Please return a JSON block exactly matching this format:
    {{
        "summary": "Brief summary of the text.",
        "action_items": ["Action item 1", "Action item 2", "..."]
    }}

    Return ONLY valid JSON.
    """

    def parse_notes(response: str) -> dict:
        # Strip markdown block formatting if present
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
        summary = data.get("summary", "")
        action_items = data.get("action_items", [])

        if not isinstance(summary, str):
            raise ValueError("Summary must be a string")
        if not isinstance(action_items, list):
            raise ValueError("Action items must be a list")

        return {"summary": summary, "action_items": action_items}

    return call_llm_with_retry(
        prompt=prompt,
        model_name=model_name,
        parse_func=parse_notes,
        fallback_value={"summary": f"Fallback summary for: {text[:50]}...", "action_items": []},
        clarification_prompt_template="The previous response was not valid JSON. Please return ONLY a valid JSON object matching the exact schema requested. Original request: {prompt}"
    )
