from services.vertex_client import generate_text

def route_user_input(user_input: str, model_name: str = "gemini-flash-lite-latest") -> str:
    """
    Routes the user input to one of the specific sub-agents.
    Expected intents: planner, calendar, notes, reminder.
    """
    prompt = f"""
    You are an intelligent orchestrator agent. Your job is to classify the user's intent into exactly one of the following categories:
    - planner (e.g., planning a project, breaking down a goal, adding a task)
    - calendar (e.g., scheduling a meeting, setting up an event)
    - notes (e.g., summarizing text, taking meeting notes)
    - reminder (e.g., setting a reminder for a specific task or checking urgency)

    User input: "{user_input}"

    Reply with ONLY the category name in lowercase (planner, calendar, notes, or reminder). If unclear, default to 'planner'.
    """

    response = generate_text(prompt, model_name).strip().lower()

    # Handle possible extra spaces or markdown formatting if the model disobeys slightly
    for intent in ['planner', 'calendar', 'notes', 'reminder']:
        if intent in response:
            return intent

    return "planner"
