"""Import necessary libraries for endpoints creation."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, UserOut, Token
from app.services.auth_service import register_user, login_user
from app.api.dependencies import get_current_user


router = APIRouter(tags=["auth"])


@router.post("/register", response_model=UserOut,
             status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    """Register user."""

    try:
        user = register_user(db, payload)
        return user
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail=str(error)) from error


@router.post("/login", response_model=Token)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    """Log In user."""

    try:
        return login_user(db, payload.email, payload.password)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from error


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    """Uses dependency to get the current user."""

    return current_user
