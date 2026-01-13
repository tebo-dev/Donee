"""Import necessary libraries for password hashing."""

from passlib.context import CryptContext

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
)


def hash_password(password: str) -> str:
    """Hash a plain password using bcrypt."""

    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against its hashed version."""

    return pwd_context.verify(plain_password, hashed_password)


def hash_reset_code(code: str) -> str:
    """Hash a plain code using bcrypt."""

    return pwd_context.hash(code)


def verify_reset_code(plain_code: str, hashed_code: str) -> bool:
    """Verify a plain reset code against its hashed version."""

    return pwd_context.verify(plain_code, hashed_code)
