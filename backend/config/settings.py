import os
import secrets
from dotenv import load_dotenv
from pydantic_settings import BaseSettings

load_dotenv()

class Settings(BaseSettings):
    PROJECT_ID: str = os.getenv("GOOGLE_CLOUD_PROJECT", "test-project")
    LOCATION: str = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
    BIGQUERY_DATASET: str = os.getenv("BIGQUERY_DATASET", "ai_ops_manager")
    PORT: int = int(os.getenv("PORT", 8080))
    SECRET_KEY: str = os.getenv("SECRET_KEY", secrets.token_urlsafe(32))
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "http://localhost:3000")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()
