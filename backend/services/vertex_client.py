import vertexai
from vertexai.generative_models import GenerativeModel
from config.settings import settings

import logging

logger = logging.getLogger(__name__)

# Initialize Vertex AI
try:
    vertexai.init(project=settings.PROJECT_ID, location=settings.LOCATION)
    model = GenerativeModel("gemini-flash-lite-latest")
except Exception as e:
    logger.error(f"Failed to initialize Vertex AI: {e}")
    # Fallback to avoid breaking tests if GCP is not properly configured
    model = None

vertex_status = "unknown"

def get_connection_status() -> str:
    """Returns the connection status of Vertex AI."""
    global vertex_status
    if vertex_status != "unknown":
        return vertex_status

    if not model:
        vertex_status = "disconnected"
        return vertex_status

    try:
        # Minimal ping to check if API is enabled and responding
        model.generate_content("ping")
        vertex_status = "connected"
    except Exception as e:
        logger.warning(f"Vertex AI connection check failed: {e}")
        vertex_status = "disconnected"

    return vertex_status

def get_available_models() -> list[str]:
    """Returns a list of available Vertex AI foundational models for chat."""
    return [
        "gemini-1.5-flash",
        "gemini-1.5-pro",
        "gemini-flash-lite-latest",
        "gemini-1.0-pro"
    ]

class VertexAIError(Exception):
    """Custom exception raised when Vertex AI is unavailable or an error occurs."""
    pass

def generate_text(prompt: str, model_name: str = "gemini-flash-lite-latest") -> str:
    """
    Generates text using the specified Gemini model on Vertex AI.
    Raises VertexAIError on failure.
    """
    if not model:
        # Raise instead of returning a mock string
        raise VertexAIError("Vertex AI is not initialized or configured properly.")

    try:
        # Use dynamic model if provided and different from the global default
        active_model = model
        if model_name and model_name != "gemini-flash-lite-latest":
             active_model = GenerativeModel(model_name)

        response = active_model.generate_content(prompt)
        return response.text
    except Exception as e:
        if "SERVICE_DISABLED" in str(e) or "has not been used in project" in str(e):
             logger.warning("Vertex AI is not enabled for this project.")
             raise VertexAIError(f"Vertex AI API not enabled: {e}")
        logger.error(f"Error calling Vertex AI: {e}")
        raise VertexAIError(f"Error generating text: {e}")
