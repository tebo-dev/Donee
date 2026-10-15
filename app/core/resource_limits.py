"""Serialize quota checks with creation so concurrent requests cannot overrun them."""

from fastapi import HTTPException
from sqlalchemy import func, select, update

from app.models.auth.user import User


def enforce_quota(db, owner_id, model, predicate, maximum):
    """Handle resource limits management."""

    db.execute(
        update(User).where(User.id == owner_id).values(token_version=User.token_version)
    )
    if db.scalar(select(func.count()).select_from(model).where(predicate)) >= maximum:
        raise HTTPException(409, "Resource limit reached.")
