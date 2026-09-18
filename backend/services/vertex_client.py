"""Lazy Google Gen AI SDK integration for Vertex AI, with bounded output and timeouts."""

import logging
import threading
from typing import TypeVar

from pydantic import BaseModel, ValidationError

from backend.config.settings import Settings

logger = logging.getLogger(__name__)
T = TypeVar("T", bound=BaseModel)


class AIUnavailable(Exception):
    pass


class AIInvalidResponse(Exception):
    pass


class VertexClient:
    def __init__(self, settings: Settings):
        self.settings = settings
        self._client = None
        self._lock = threading.Lock()
        self.status = "configured" if settings.ai_mode == "vertex" else settings.ai_mode

    def _get_client(self):
        with self._lock:
            if self._client is None:
                from google import genai
                from google.genai import types

                self._client = genai.Client(
                    vertexai=True,
                    project=self.settings.google_cloud_project,
                    location=self.settings.google_cloud_location,
                    http_options=types.HttpOptions(
                        timeout=self.settings.ai_timeout_seconds * 1000,
                        retry_options=types.HttpRetryOptions(attempts=1),
                    ),
                )
            return self._client

    def generate(self, prompt: str, schema: type[T], model: str) -> T:
        if self.settings.ai_mode != "vertex" or model not in self.settings.models:
            raise AIUnavailable("AI is not configured for this model.")
        try:
            from google.genai import types

            response = self._get_client().models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=schema,
                    temperature=0.2,
                    max_output_tokens=4096,
                    # Disable SDK automatic function execution: models only propose data.
                    automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
                ),
            )
            if not response.text or len(response.text) > 65_536:
                raise AIInvalidResponse(
                    "The model returned an empty or oversized response. Nothing was saved."
                )
            result = schema.model_validate_json(response.text)
        except (ValidationError, AIInvalidResponse) as exc:
            self.status = "last_request_failed"
            raise AIInvalidResponse(
                "The model returned an invalid proposal. Nothing was saved. Please try a more specific request."
            ) from exc
        except Exception as exc:
            self.status = "last_request_failed"
            logger.warning("vertex_request_failed type=%s", type(exc).__name__)
            raise AIUnavailable(
                "Vertex AI is unavailable or timed out. Nothing was saved. Try again later, or create the item manually."
            ) from exc
        self.status = "last_request_succeeded"
        return result

    def close(self):
        if self._client:
            self._client.close()
