"""Import the necessary libraries for the project configuration."""

from typing import Literal

from pydantic import EmailStr, Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configurate the project."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=True
    )

    # Base
    ENVIRONMENT: Literal["development", "test", "production"] = "production"
    API_V1_PREFIX: str = Field(default="/api")

    # Database
    DATABASE_URL: str

    # Authentication / JWT
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = Field(default="HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=60)

    # Mailgun
    MAILGUN_API_KEY: SecretStr | None = None
    MAILGUN_DOMAIN: str = ""
    MAILGUN_FROM: EmailStr | None = None
    MAILGUN_REGION: Literal["us", "eu"] = "us"
    DEVELOPMENT_EMAIL: EmailStr | None = None

    # AWS / S3

    AWS_ACCESS_KEY_ID: str
    AWS_SECRET_ACCESS_KEY: SecretStr
    AWS_REGION: str = "us-east-2"
    AWS_S3_BUCKET_NAME: str


settings = Settings()
