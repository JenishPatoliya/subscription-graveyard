# backend/config/settings.py
# Pydantic settings — type-safe environment variables

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Server
    PORT: int = 8000
    FRONTEND_URL: str = "http://localhost:3000"
    BACKEND_URL: str = "http://localhost:8000"

    # JWT
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_DAYS: int = 7

    # Supabase
    SUPABASE_URL: str
    SUPABASE_SERVICE_KEY: str

    # Google OAuth
    GOOGLE_CLIENT_ID: str
    GOOGLE_CLIENT_SECRET: str

    # Groq AI
    GROQ_API_KEY: str

    # Resend Email
    RESEND_API_KEY: str = ""

    # Demo Account
    DEMO_EMAIL: str = "demo@subscriptiongraveyard.com"
    DEMO_PASSWORD: str = "demo123"

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
