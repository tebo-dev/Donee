"""Import necessary libraries for endpoints creation."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import Token, UserCreate, UserLogin, UserOut
from app.services.auth_service import login_user, register_user

router = APIRouter(tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    """Register user."""

    user = register_user(db, payload)
    return user


@router.post("/login", response_model=Token)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    """Log In user."""

    return login_user(db, payload.email, payload.password)


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    """Uses dependency to get the current user."""

    return current_user
