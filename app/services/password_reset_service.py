"""Import necessary libraries for password reset service."""

from datetime import datetime, timedelta, timezone
from secrets import randbelow
from uuid import UUID

from sqlalchemy import delete, desc, select
from sqlalchemy.orm import Session

from app.core.domain_errors import InvalidCode
from app.core.security import hash_password, hash_reset_code
from app.core.security import verify_reset_code as verify_reset_code_hash
from app.models.password_reset import PasswordResetToken
from app.schemas.password_reset import (
    ForgotPasswordRequest,
    ResetPasswordRequest,
    VerifyResetCodeRequest,
)
from app.services.auth_service import get_user_by_email

# Helpers


def gen_random_code() -> str:
    """Generate a 6-digit numeric code as a string."""

    return f"{randbelow(1_000_000):06d}"


def normalize_utc(dt: datetime) -> datetime:
    """Ensure DB datetime is timezone-aware UTC."""

    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def get_latest_token_for_user(db: Session, user_id: UUID) -> PasswordResetToken | None:
    """Get the latest reset token for a user."""

    stmt = (
        select(PasswordResetToken)
        .where(PasswordResetToken.user_id == user_id)
        .order_by(desc(PasswordResetToken.expires_at))
    )
    return db.execute(stmt).scalars().first()


def invalidate_reset_tokens_for_user(db: Session, user_id: UUID) -> None:
    """Delete all reset tokens for the user."""

    stmt = delete(PasswordResetToken).where(PasswordResetToken.user_id == user_id)
    db.execute(stmt)


# Main services


def request_password_reset(db: Session, payload: ForgotPasswordRequest) -> str:
    """Create a password reset code and store its hash."""

    user = get_user_by_email(db, payload.email)
    if not user:
        return None

    code = gen_random_code()
    code_hash = hash_reset_code(code)

    token = PasswordResetToken(
        user_id=user.id,
        code_hash=code_hash,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
    )

    db.add(token)
    db.commit()
    db.refresh(token)

    return code


def verify_reset_code_service(db: Session, payload: VerifyResetCodeRequest) -> bool:
    """Verify reset code for email."""

    user = get_user_by_email(db, payload.email)
    if not user:
        raise InvalidCode()

    token = get_latest_token_for_user(db, user.id)
    if not token:
        raise InvalidCode()

    if normalize_utc(token.expires_at) < datetime.now(timezone.utc):
        raise InvalidCode()

    if not verify_reset_code_hash(payload.code, token.code_hash):
        raise InvalidCode()

    return True


def reset_password_service(db: Session, payload: ResetPasswordRequest) -> None:
    """Reset password."""

    user = get_user_by_email(db, payload.email)
    if not user:
        raise InvalidCode()

    token = get_latest_token_for_user(db, user.id)
    if not token:
        raise InvalidCode()

    if normalize_utc(token.expires_at) < datetime.now(timezone.utc):
        raise InvalidCode()

    if not verify_reset_code_hash(payload.code, token.code_hash):
        raise InvalidCode()

    user.password_hash = hash_password(payload.new_password)

    invalidate_reset_tokens_for_user(db, user.id)

    db.commit()
