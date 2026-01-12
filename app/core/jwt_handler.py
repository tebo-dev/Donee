"""Import necessary libraries for jwt tokens creation and handling."""

from datetime import datetime, timedelta, timezone
from typing import Any

from jose import jwt

from app.core.config import settings


def create_access_token(
    data: dict[str, Any], expires_delta: timedelta | None = None
) -> str:
    """Create a signed JWT access token."""

    to_encode = data.copy()

    now = datetime.now(timezone.utc)

    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    expire = now + expires_delta

    to_encode.update(
        {
            "exp": expire,
            "iat": now,
        }
    )

    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )

    return encoded_jwt


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode and validate a JWT access token."""

    payload = jwt.decode(
        token,
        settings.JWT_SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM],
    )

    return payload
