"""Import necessary libraries for endpoints creation."""

import hashlib
from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, oauth2_scheme
from app.core.jwt_handler import decode_access_token
from app.core.rate_limit import enforce_auth_limit
from app.db.session import get_db
from app.models.auth.user import User
from app.schemas.auth.user import RefreshRequest, Token, UserCreate, UserLogin, UserOut
from app.services.auth.auth_service import login_user, register_user
from app.services.auth.session_service import (
    refresh_session,
    revoke_all_sessions,
    revoke_session,
)

router = APIRouter(tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, request: Request, db: Session = Depends(get_db)):
    """Register user."""

    enforce_auth_limit(db, request, "register", str(payload.email))
    user = register_user(db, payload)
    return user


@router.post("/login", response_model=Token)
def login(
    payload: UserLogin,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Log In user."""

    response.headers["Cache-Control"] = "no-store"
    enforce_auth_limit(db, request, "login", str(payload.email))
    return login_user(db, payload.email, payload.password)


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    """Uses dependency to get the current user."""

    return current_user


@router.post("/refresh", response_model=Token)
def refresh(
    payload: RefreshRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Rotate an opaque refresh credential and return a new token pair."""
    response.headers["Cache-Control"] = "no-store"
    enforce_auth_limit(
        db,
        request,
        "refresh",
        hashlib.sha256(payload.refresh_token.encode()).hexdigest(),
    )
    return refresh_session(db, payload.refresh_token)


@router.post("/logout")
def logout(
    user: User = Depends(get_current_user),
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    """Immediately revoke the login session identified by this access token."""
    revoke_session(db, user.id, UUID(decode_access_token(token)["sid"]))
    return {"message": "Signed out successfully."}


@router.post("/logout-all")
def logout_all(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Immediately revoke every session belonging to the authenticated user."""
    revoke_all_sessions(db, user.id)
    return {"message": "Signed out everywhere successfully."}
