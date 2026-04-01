from services.vertex_client import generate_text
import re

def generate_tasks(goal: str) -> list[str]:
    """
    Generates an actionable bullet-point list of tasks from a goal.
    """
    prompt = f"""
    You are a Planner Agent. Your job is to break down a user's goal into smaller, actionable tasks.

    Goal: "{goal}"

    Return ONLY a clean bullet list of tasks where each task is on a new line and starts with a dash (-).
    Keep tasks concise and actionable.
    """

    response = generate_text(prompt).strip()

    # Extract bullet points
    tasks = []
    for line in response.split('\n'):
        line = line.strip()
        if line.startswith('-') or line.startswith('*'):
            tasks.append(re.sub(r'^[-\*]\s*', '', line))

    # Fallback if parsing fails but response exists
    if not tasks and response:
        # Split by new lines if the model ignored bullets
        tasks = [t.strip() for t in response.split('\n') if t.strip()]

    return tasks
