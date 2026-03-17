"""Import necessary libraries for password reset implementation."""

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ForgotPasswordRequest(BaseModel):
    """Schema for password reset request."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    email: EmailStr


class VerifyResetCodeRequest(BaseModel):
    """Schema for code verification request."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    email: EmailStr
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class ResetPasswordRequest(BaseModel):
    """Schema to reset password."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    email: EmailStr
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")
    new_password: str = Field(min_length=8, max_length=128)
