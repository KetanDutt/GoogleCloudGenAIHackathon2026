from agents.agent_utils import call_llm_with_retry
import re
import logging

logger = logging.getLogger(__name__)

def generate_tasks(goal: str, model_name: str = "gemini-flash-lite-latest") -> list[str]:
    """
    Generates an actionable bullet-point list of tasks from a goal.
    """
    prompt = f"""
    You are a Planner Agent. Your job is to break down a user's goal into smaller, actionable tasks.

    Goal: "{goal}"

    Return ONLY a clean bullet list of tasks where each task is on a new line and starts with a dash (-).
    Keep tasks concise and actionable.
    """

    def parse_tasks(response: str) -> list[str]:
        tasks = []
        for line in response.split('\n'):
            line = line.strip()
            if line.startswith('-') or line.startswith('*'):
                tasks.append(re.sub(r'^[-\*]\s*', '', line))

        if not tasks:
             # Try splitting by new lines if bullets were missed
             tasks = [t.strip() for t in response.split('\n') if t.strip()]

        if not tasks:
             raise ValueError("Could not extract any tasks from the response.")

        return tasks

    return call_llm_with_retry(
        prompt=prompt,
        model_name=model_name,
        parse_func=parse_tasks,
        fallback_value=[f"Complete goal: {goal}"],
        clarification_prompt_template="The previous response was not a valid bulleted list. Please provide a simple list of tasks starting with dashes (-). Original request: {prompt}"
    )
