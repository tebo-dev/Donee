"""Session creation, refresh rotation, replay detection and revocation."""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.jwt_handler import create_access_token
from app.models.auth.session import AuthSession, RefreshToken
from app.models.auth.user import User
from app.schemas.auth.user import Token
from app.utils.dates import normalize_utc


def unauthorized():
    """Use the same failure for missing, expired and revoked credentials."""
    return HTTPException(
        401, "Could not verify credentials.", headers={"WWW-Authenticate": "Bearer"}
    )


def lock_user(db: Session, user_id: UUID) -> User | None:
    """Serialize refresh, logout and password reset on the user row."""
    db.execute(
        update(User).where(User.id == user_id).values(token_version=User.token_version)
    )
    return db.scalar(
        select(User).where(User.id == user_id).execution_options(populate_existing=True)
    )


def session_is_active(session: AuthSession | None) -> bool:
    """Check absolute expiry and revocation for access and refresh requests."""
    return (
        session is not None
        and session.revoked_at is None
        and normalize_utc(session.expires_at) > datetime.now(timezone.utc)
    )


def _issue_pair(db: Session, user: User, session: AuthSession) -> Token:
    refresh = secrets.token_urlsafe(48)
    db.add(
        RefreshToken(
            token_hash=hashlib.sha256(refresh.encode()).hexdigest(),
            session_id=session.id,
        )
    )
    remaining = normalize_utc(session.expires_at) - datetime.now(timezone.utc)
    access_seconds = min(
        settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60, int(remaining.total_seconds())
    )
    if access_seconds <= 0:
        raise unauthorized()
    access = create_access_token(
        {
            "sub": str(user.id),
            "ver": user.token_version,
            "sid": str(session.id),
            "type": "access",
        },
        expires_delta=timedelta(seconds=access_seconds),
    )
    return Token(
        access_token=access,
        refresh_token=refresh,
        expires_in=access_seconds,
        refresh_expires_in=int(remaining.total_seconds()),
    )


def create_session(db: Session, user: User) -> Token:
    """Caller commits this session with the login/password-reset transaction."""
    # Cascade removes spent hashes only after their entire session has expired.
    db.execute(
        delete(AuthSession).where(
            AuthSession.user_id == user.id,
            AuthSession.expires_at <= datetime.now(timezone.utc),
        )
    )
    session = AuthSession(
        user_id=user.id,
        expires_at=datetime.now(timezone.utc)
        + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(session)
    db.flush()
    return _issue_pair(db, user, session)


def refresh_session(db: Session, credential: str) -> Token:
    """Consume a refresh token once; replay revokes its entire login session."""
    digest = hashlib.sha256(credential.encode()).hexdigest()
    record = db.get(RefreshToken, digest)
    if record is None:
        raise unauthorized()
    session = db.get(AuthSession, record.session_id)
    user = lock_user(db, session.user_id) if session else None
    # Reload after taking the lock so concurrent requests see rotation/revocation.
    record = db.scalar(
        select(RefreshToken)
        .where(RefreshToken.token_hash == digest)
        .execution_options(populate_existing=True)
    )
    session = (
        db.scalar(
            select(AuthSession)
            .where(AuthSession.id == session.id)
            .execution_options(populate_existing=True)
        )
        if session
        else None
    )
    if (
        record is None
        or not user
        or not user.is_active
        or not session_is_active(session)
    ):
        raise unauthorized()
    if record.used_at is not None:
        session.revoked_at = datetime.now(timezone.utc)
        db.commit()
        raise unauthorized()
    record.used_at = datetime.now(timezone.utc)
    pair = _issue_pair(db, user, session)
    db.commit()
    return pair


def revoke_session(db: Session, user_id: UUID, session_id: UUID) -> None:
    """Revoke both access and refresh credentials for the current login."""
    lock_user(db, user_id)
    db.execute(
        update(AuthSession)
        .where(AuthSession.id == session_id, AuthSession.user_id == user_id)
        .values(revoked_at=datetime.now(timezone.utc))
    )
    db.commit()


def revoke_all_sessions(db: Session, user_id: UUID) -> None:
    """Invalidate all tokens, including any credentials issued before deployment."""
    db.execute(
        update(User)
        .where(User.id == user_id)
        .values(token_version=User.token_version + 1)
    )
    db.execute(
        update(AuthSession)
        .where(AuthSession.user_id == user_id, AuthSession.revoked_at.is_(None))
        .values(revoked_at=datetime.now(timezone.utc))
    )
    db.commit()
