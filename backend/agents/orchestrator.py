from agents.agent_utils import call_llm_with_retry

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

    def parse_intent(response: str) -> str:
        response_clean = response.strip().lower()
        for valid_intent in ['planner', 'calendar', 'notes', 'reminder']:
            if valid_intent in response_clean:
                return valid_intent
        raise ValueError(f"Could not extract a valid intent from response: {response}")

    return call_llm_with_retry(
        prompt=prompt,
        model_name=model_name,
        parse_func=parse_intent,
        fallback_value="planner",
        clarification_prompt_template="The previous response was invalid. Please reply with ONLY ONE of the following words and nothing else: planner, calendar, notes, reminder. Original request: {prompt}"
    )
