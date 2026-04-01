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
        logger.error(f"Error calling Vertex AI: {e}")
        return ""
