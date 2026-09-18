"""Validated runtime configuration. Importing modules never contacts Google Cloud."""

import os
from pathlib import Path
from typing import Literal
from urllib.parse import urlparse

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        hide_input_in_errors=True,
    )

    environment: Literal["development", "test", "production"] = "development"
    database_url: str = f"sqlite:///{BACKEND_DIR / 'data' / 'workspace.db'}"
    ai_mode: Literal["demo", "vertex", "disabled"] = "demo"
    allow_demo_login: bool = True
    google_cloud_project: str = ""
    google_cloud_location: str = "us-central1"
    bigquery_dataset: str = "ai_ops_analytics"
    bigquery_location: str = "US"
    allowed_models: str = "gemini-2.5-flash,gemini-2.5-flash-lite"
    default_model: str = "gemini-2.5-flash"
    ai_timeout_seconds: int = Field(default=20, ge=5, le=25)
    session_hours: int = Field(default=12, ge=1, le=168)
    cookie_secure: bool = False
    cookie_samesite: Literal["lax", "strict", "none"] = "lax"
    cookie_partitioned: bool = False
    cors_origins: str = "http://localhost:3000"
    auth_rate_limit: int = Field(default=20, ge=1, le=1000)
    chat_rate_limit: int = Field(default=12, ge=1, le=100)
    max_body_bytes: int = Field(default=65_536, ge=1024, le=1_048_576)

    @property
    def models(self) -> list[str]:
        return list(dict.fromkeys(m.strip() for m in self.allowed_models.split(",") if m.strip()))

    @property
    def origins(self) -> list[str]:
        return [
            origin.strip().rstrip("/") for origin in self.cors_origins.split(",") if origin.strip()
        ]

    @property
    def cookie_name(self) -> str:
        return "__Host-aiops_session" if self.cookie_secure else "aiops_session"

    @model_validator(mode="after")
    def check_configuration(self):
        if not self.database_url.startswith(("sqlite:///", "postgresql+psycopg://")):
            raise ValueError("DATABASE_URL must use sqlite:/// or postgresql+psycopg://")
        if self.default_model not in self.models:
            raise ValueError("DEFAULT_MODEL must be in ALLOWED_MODELS")
        if self.ai_mode == "vertex" and not self.google_cloud_project:
            raise ValueError("GOOGLE_CLOUD_PROJECT is required for Vertex AI")
        for origin in self.origins:
            parsed = urlparse(origin)
            if (
                parsed.scheme not in {"http", "https"}
                or not parsed.hostname
                or parsed.path
                or parsed.query
                or parsed.fragment
                or parsed.username
                or parsed.password
                or "*" in origin
            ):
                raise ValueError(
                    "CORS_ORIGINS must contain explicit HTTP(S) origins, not wildcards"
                )
        if self.cookie_samesite == "none" and not self.cookie_secure:
            raise ValueError("SameSite=None cookies require COOKIE_SECURE=true")
        if self.cookie_partitioned and (not self.cookie_secure or self.cookie_samesite != "none"):
            raise ValueError("Partitioned cookies require secure cookies and SameSite=None")
        if os.getenv("K_SERVICE") and self.environment != "production":
            raise ValueError("Cloud Run services must use ENVIRONMENT=production")
        if self.environment == "production":
            if not self.database_url.startswith("postgresql+psycopg://"):
                raise ValueError(
                    "Production requires PostgreSQL; local SQLite is not durable on Cloud Run"
                )
            if not self.cookie_secure:
                raise ValueError("COOKIE_SECURE must be true in production")
            if self.allow_demo_login or self.ai_mode == "demo":
                raise ValueError("Demo mode and demo login must be disabled in production")
            if any(not origin.startswith("https://") for origin in self.origins):
                raise ValueError("Production origins must use HTTPS")
        return self
