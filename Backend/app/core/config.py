from typing import Optional
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # App Settings
    PROJECT_NAME: str = "Habilio API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    FRONTEND_URL: str = "http://localhost:3000"

    # Email Settings (for fastapi-mail)
    # Defaulting to a dummy valid email so the app starts without errors if env vars are missing.
    MAIL_USERNAME: str = "dummy@example.com"
    MAIL_PASSWORD: str = "dummy"
    MAIL_FROM: str = "dummy@example.com"
    MAIL_PORT: int = 587
    MAIL_SERVER: str = "smtp.gmail.com"
    MAIL_FROM_NAME: str = "Habilio Notificaciones"
    MAIL_STARTTLS: bool = True
    MAIL_SSL_TLS: bool = False
    USE_CREDENTIALS: bool = True
    VALIDATE_CERTS: bool = True

    # Text moderation settings
    TEXT_MODERATION_LEVEL: str = "medium"  # strict | medium | relaxed
    TEXT_MODERATION_ENABLE_PROFANITY: bool = True
    TEXT_MODERATION_EXTRA_BLOCKED_TERMS: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True

settings = Settings()
