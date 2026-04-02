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
    elif response.startswith("```"):
        response = response.replace("```", "", 1).replace("```", "")

    try:
        data = json.loads(response.strip())
        summary = data.get("summary", "")
        if not isinstance(summary, str):
            summary = str(summary)

        action_items = data.get("action_items", [])
        if not isinstance(action_items, list):
            action_items = []

    except json.JSONDecodeError:
        summary = "Could not parse summary from LLM response. The raw response was: " + response[:100] + "..."
        action_items = []
    except Exception as e:
        summary = f"Unexpected error during parsing: {e}"
        action_items = []

    return {"summary": summary, "action_items": action_items}
