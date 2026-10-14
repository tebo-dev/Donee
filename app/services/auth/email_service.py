"""Transactional mail."""

import httpx
from fastapi import HTTPException

from app.core.config import settings


def send_email(recipient: str, subject: str, body: str) -> None:
    """Create and send email to user email."""

    if not all(
        (settings.MAILGUN_API_KEY, settings.MAILGUN_DOMAIN, settings.MAILGUN_FROM)
    ):
        raise HTTPException(
            503, "Email service is unavailable. Please try again later."
        )
    if settings.ENVIRONMENT != "production":
        if not settings.DEVELOPMENT_EMAIL:
            raise HTTPException(503, "Development email recipient is not configured.")
        recipient = str(settings.DEVELOPMENT_EMAIL)

    host = (
        "api.eu.mailgun.net" if settings.MAILGUN_REGION == "eu" else "api.mailgun.net"
    )

    try:
        response = httpx.post(
            f"https://{host}/v3/{settings.MAILGUN_DOMAIN}/messages",
            auth=("api", settings.MAILGUN_API_KEY.get_secret_value()),
            files={
                key: (None, value)
                for key, value in {
                    "from": str(settings.MAILGUN_FROM),
                    "to": recipient,
                    "subject": subject,
                    "text": body,
                    "o:tracking": "no",
                    "o:tracking-clicks": "no",
                }.items()
            },
            timeout=10,
        )
        response.raise_for_status()
    except httpx.HTTPError:
        raise HTTPException(
            503, "Email service is unavailable. Please try again later."
        ) from None
