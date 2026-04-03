import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_ID: str = os.getenv("GOOGLE_CLOUD_PROJECT", "test-project")
    LOCATION: str = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
    BIGQUERY_DATASET: str = os.getenv("BIGQUERY_DATASET", "ai_ops_manager")
    PORT: int = int(os.getenv("PORT", 8080))
    SECRET_KEY: str = os.getenv("SECRET_KEY", "fallback-secret-key-for-local-dev-only")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()
