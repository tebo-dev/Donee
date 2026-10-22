"""Import necessary libraries for password reset schemas implementation."""

from pydantic import EmailStr, Field

from app.schemas.auth.user import AuthInput


class ForgotPasswordRequest(AuthInput):
    """Schema for password reset request."""

    email: EmailStr


class VerifyResetCodeRequest(AuthInput):
    """Schema for code verification request."""

    email: EmailStr
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class ResetPasswordRequest(AuthInput):
    """Schema to reset password; new_password retains all whitespace."""

    email: EmailStr
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")
    new_password: str = Field(min_length=8, max_length=128)
