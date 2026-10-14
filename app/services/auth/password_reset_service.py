"""Password reset services."""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.core.domain_errors.auth_domain_errors import InvalidCode
from app.core.jwt_handler import create_access_token
from app.core.security import hash_password, hash_reset_code, verify_reset_code
from app.models.auth.password_reset import PasswordResetToken
from app.models.auth.user import User
from app.schemas.auth.password_reset import (
    ForgotPasswordRequest,
    ResetPasswordRequest,
    VerifyResetCodeRequest,
)
from app.schemas.auth.user import Token
from app.services.auth.email_service import send_email
from app.utils.codes import gen_random_code
from app.utils.dates import normalize_utc

# Helpers


def invalidate_reset_tokens_for_user(db: Session, user_id: UUID) -> None:
    """Delete all password reset tokens for the user."""

    db.execute(delete(PasswordResetToken).where(PasswordResetToken.user_id == user_id))


def _lock_user(db: Session, email: str) -> User | None:
    """Lock user record in DB and return last version of it."""

    db.execute(
        update(User).where(User.email == email).values(token_version=User.token_version)
    )

    return db.scalar(
        select(User)
        .where(User.email == email)
        .execution_options(populate_existing=True)
    )


def _validate_challenge(db: Session, email: str, code: str) -> User:
    """Validate reset code inputs."""

    user = _lock_user(db, email)
    token = (
        None
        if not user
        else db.scalar(
            select(PasswordResetToken)
            .where(PasswordResetToken.user_id == user.id)
            .order_by(PasswordResetToken.expires_at.desc())
            .execution_options(populate_existing=True)
        )
    )

    if (
        not user
        or not user.is_active
        or not token
        or token.failed_attempts >= 3
        or normalize_utc(token.expires_at) <= datetime.now(timezone.utc)
    ):
        db.rollback()
        raise InvalidCode()
    if not verify_reset_code(code, token.code_hash):
        token.failed_attempts += 1
        db.commit()
        raise InvalidCode()
    return user


# Main Service


def request_password_reset(db: Session, payload: ForgotPasswordRequest) -> bool:
    """Create DB record for password reset and send reset code."""

    user = _lock_user(db, str(payload.email))
    if not user or not user.is_active:
        db.rollback()
        return False

    code = gen_random_code()
    invalidate_reset_tokens_for_user(db, user.id)
    db.add(
        PasswordResetToken(
            user_id=user.id,
            code_hash=hash_reset_code(code),
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
        )
    )

    try:
        send_email(
            user.email,
            "Reset your Donee password",
            f"""Your Donee password reset code is {code}.
             It expires in 10 minutes.\n
            If you did not request this, ignore this message.""",
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    return True


def verify_reset_code_service(db: Session, payload: VerifyResetCodeRequest) -> bool:
    """Verify reset code."""

    _validate_challenge(db, str(payload.email), payload.code)
    db.commit()
    return True


def reset_password_service(db: Session, payload: ResetPasswordRequest) -> Token:
    """Reset user password."""

    user = _validate_challenge(db, str(payload.email), payload.code)
    user.password_hash = hash_password(payload.new_password)
    user.token_version += 1

    invalidate_reset_tokens_for_user(db, user.id)
    db.commit()

    return Token(
        access_token=create_access_token(
            {"sub": str(user.id), "ver": user.token_version}
        )
    )
