import vertexai
from vertexai.generative_models import GenerativeModel
from config.settings import settings

import logging

logger = logging.getLogger(__name__)

# Initialize Vertex AI
try:
    vertexai.init(project=settings.PROJECT_ID, location=settings.LOCATION)
    model = GenerativeModel("gemini-1.5-flash")
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

def generate_text(prompt: str) -> str:
    """
    Generates text using the Gemini 1.5 Flash model on Vertex AI.
    """
    if not model:
        # Mocking or returning a default response if not configured
        return f"[Mock VertexAI] Prompt received: {prompt}"

    try:
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        if "SERVICE_DISABLED" in str(e) or "has not been used in project" in str(e):
             logger.warning("Vertex AI is not enabled for this project. Returning mock fallback.")
             return f"[Mock VertexAI Fallback] Attempted to process: {prompt[:50]}..."
        logger.error(f"Error calling Vertex AI: {e}")
        return ""
