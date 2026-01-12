"""Import necessary libraries to create the dependencies."""

from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.jwt_handler import decode_access_token
from app.db.session import get_db
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
) -> User:
    """Returns the current authenticated user."""

    credential_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not verify credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_access_token(token)
        sub = payload.get("sub")

        if sub is None:
            raise credential_exception

    except JWTError as error:
        raise credential_exception from error

    stmt = select(User).where(User.id == UUID(sub))
    user = db.execute(stmt).scalars().first()

    if user is None or not user.is_active:
        raise credential_exception

    return user
