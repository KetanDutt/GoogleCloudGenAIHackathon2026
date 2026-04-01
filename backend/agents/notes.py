import json
from services.vertex_client import generate_text

def summarize_and_extract(text: str) -> dict:
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

    response = generate_text(prompt).strip()

    # Strip markdown block formatting if present
    if response.startswith("```json"):
        response = response.replace("```json", "", 1).replace("```", "")

    try:
        data = json.loads(response.strip())
        summary = data.get("summary", "")
        action_items = data.get("action_items", [])
    except json.JSONDecodeError:
        summary = "Error parsing notes"
        action_items = []

    return {"summary": summary, "action_items": action_items}
