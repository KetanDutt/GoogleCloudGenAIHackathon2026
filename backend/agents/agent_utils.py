import logging
from typing import Callable, Any
from services.vertex_client import generate_text, VertexAIError

logger = logging.getLogger(__name__)

def call_llm_with_retry(
    prompt: str,
    model_name: str,
    parse_func: Callable[[str], Any],
    fallback_value: Any,
    clarification_prompt_template: str = "The previous response could not be parsed. Please output strictly adhering to the format. Original request: {prompt}",
) -> Any:
    """
    Calls the LLM, attempts to parse the response, and retries once on failure.
    If the LLM is unavailable or parsing fails twice, it returns a deterministic fallback_value.

    Args:
        prompt: The main prompt for the agent.
        model_name: The Gemini model name to use.
        parse_func: A function that takes the raw text output and returns a structured object. Should raise an Exception if parsing fails.
        fallback_value: The structured value to return on total failure.
        clarification_prompt_template: A template to use if the first parse fails.
    """
    try:
        raw_response = generate_text(prompt, model_name)
    except VertexAIError as e:
        logger.warning(f"VertexAI unavailable. Using fallback. Error: {e}")
        return fallback_value

    try:
        return parse_func(raw_response)
    except Exception as e:
        logger.warning(f"Failed to parse LLM response on first attempt: {e}. Retrying with strict prompt.")

    # Retry once with stricter prompt
    strict_prompt = clarification_prompt_template.format(prompt=prompt)
    try:
        retry_response = generate_text(strict_prompt, model_name)
    except VertexAIError as e:
        logger.warning(f"VertexAI unavailable on retry. Using fallback. Error: {e}")
        return fallback_value

    try:
        return parse_func(retry_response)
    except Exception as e:
        logger.error(f"Failed to parse LLM response on second attempt: {e}. Using fallback.")
        return fallback_value
