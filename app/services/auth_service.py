"""Import necessary libraries for authentication service."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.jwt_handler import create_access_token
from app.core.security import hash_password, verify_password
from app.models.user import User
from app.schemas.user import Token, UserCreate

# Helpers


def get_user_by_email(db: Session, email: str) -> User | None:
    """Get an user by their email."""

    stmt = select(User).where(User.email == email)
    return db.execute(stmt).scalars().first()


def get_user_by_username(db: Session, username: str) -> User | None:
    """Get an user by their username."""

    stmt = select(User).where(User.username == username)
    return db.execute(stmt).scalars().first()


# Main service


def register_user(db: Session, user_create: UserCreate) -> User:
    """Create a new user."""

    if get_user_by_email(db, user_create.email):
        raise ValueError("Email already registered.")

    if get_user_by_username(db, user_create.username):
        raise ValueError("Username already taken.")

    hashed = hash_password(user_create.password)

    user = User(
        email=user_create.email,
        username=user_create.username,
        password_hash=hashed,
        is_active=True,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    """Validate credentials."""

    user = get_user_by_email(db, email)

    if not user:
        return None

    if not user.is_active:
        return None

    if not verify_password(password, user.password_hash):
        return None

    return user


def login_user(db: Session, email: str, password: str) -> Token:
    """Authenticate user and return a JWT token schema."""

    user = authenticate_user(db, email, password)

    if not user:
        raise ValueError("Invalid credentials.")

    token = create_access_token({"sub": str(user.id)})

    return Token(access_token=token)
