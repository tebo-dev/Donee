"""Import the necessary libraries for the project configuration."""

from typing import Literal
from urllib.parse import urlsplit

from pydantic import EmailStr, Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configurate the project."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=True
    )

    # Base
    ENVIRONMENT: Literal["development", "test", "production"] = "production"
    API_V1_PREFIX: str = Field(default="/api")

    # CORS
    CORS_ALLOWED_ORIGINS: list[str] = Field(default_factory=list)

    @field_validator("CORS_ALLOWED_ORIGINS")
    @classmethod
    def validate_cors_origins(cls, origins: list[str]) -> list[str]:
        """Validate origins."""
        for origin in origins:
            parsed = urlsplit(origin)
            if (
                parsed.scheme not in {"http", "https"}
                or not parsed.hostname
                or "*" in origin
                or any(character.isspace() for character in origin)
                or parsed.username is not None
                or parsed.password is not None
                or parsed.path
                or "?" in origin
                or "#" in origin
            ):
                raise ValueError(
                    "CORS origins must be exact HTTP(S) origins without paths, "
                    "credentials, or wildcards"
                )
            _ = parsed.port
        return origins

    # Database
    DATABASE_URL: str

    # Authentication / JWT
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = Field(default="HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=60)

    # AWS / S3

    AWS_ACCESS_KEY_ID: str
    AWS_SECRET_ACCESS_KEY: SecretStr
    AWS_REGION: str = "us-east-2"
    AWS_S3_BUCKET_NAME: str

    # Mailgun
    MAILGUN_API_KEY: SecretStr | None = None
    MAILGUN_DOMAIN: str = ""
    MAILGUN_FROM: EmailStr | None = None
    MAILGUN_REGION: Literal["us", "eu"] = "us"
    DEVELOPMENT_EMAIL: EmailStr | None = None


settings = Settings()
