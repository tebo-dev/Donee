"""Database-backed fixed-window limits, shared by all application workers."""

import hashlib
import hmac
import time

from fastapi import HTTPException, Request
from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.auth.rate_limit import RateLimit


def enforce_auth_limit(db: Session, request: Request, action: str, email: str) -> None:
    """Define and enforce limits in password reset logic."""

    now = int(time.time())
    window = 15 * 60
    expires = (now // window + 1) * window
    ip = request.client.host if request.client else "unknown"
    identities = [("account", email.casefold(), 3), ("source", ip, 30)]

    if db.bind.dialect.name == "postgresql":
        insert = pg_insert
    else:
        insert = sqlite_insert

    db.execute(delete(RateLimit).where(RateLimit.expires_at <= now))

    for kind, value, limit in identities:

        key = hmac.new(
            settings.JWT_SECRET_KEY.encode(),
            f"{action}:{kind}:{value}:{now // window}".encode(),
            hashlib.sha256,
        ).hexdigest()

        stmt = insert(RateLimit).values(key=key, count=1, expires_at=expires)
        stmt = stmt.on_conflict_do_update(
            index_elements=[RateLimit.key],
            set_={"count": RateLimit.count + 1},
            where=RateLimit.count < limit,
        ).returning(RateLimit.count)

        if db.execute(stmt).scalar_one_or_none() is None:
            db.commit()
            raise HTTPException(
                429,
                "Too many attempts. Try again later.",
                headers={"Retry-After": str(expires - now)},
            )
    db.commit()
