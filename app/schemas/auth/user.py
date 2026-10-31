"""Import the necessary libraries for user schemas creation."""

from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StrictBool, field_validator

from app.core.legal import ACCEPTABLE_USE_VERSION, TERMS_VERSION

# Requests


class AuthInput(BaseModel):
    """Normalize identifiers, preserving passwords exactly as supplied."""

    model_config = ConfigDict(extra="forbid")

    @field_validator("*", mode="before")
    @classmethod
    def trim_identifiers(cls, value, info):
        """Strip identifiers without normalizing credential bytes."""
        if info.field_name not in {"password", "new_password"} and isinstance(
            value, str
        ):
            return value.strip()
        return value


class UserCreate(AuthInput):
    """Registration input."""

    email: EmailStr
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=8, max_length=128)
    terms_accepted: StrictBool
    terms_version: str = Field(min_length=1, max_length=40)
    acceptable_use_version: str = Field(min_length=1, max_length=40)

    @field_validator("terms_accepted")
    @classmethod
    def require_agreement(cls, value):
        """Reject false and require an explicit JSON boolean true."""
        if not value:
            raise ValueError(
                "Agreement to the Terms and Acceptable Use Policy is required."
            )
        return value

    @field_validator("terms_version", "acceptable_use_version")
    @classmethod
    def require_current_version(cls, value, info):
        """An old client must not silently accept newer terms."""
        expected = (
            TERMS_VERSION
            if info.field_name == "terms_version"
            else ACCEPTABLE_USE_VERSION
        )
        if value != expected:
            raise ValueError(
                "Policy version is outdated. "
                "Reload Donee and review the current policies."
            )
        return value


class UserLogin(AuthInput):
    """Login input."""

    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


# Responses


class UserOut(BaseModel):
    """Schema to provide a stable form to the client."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: EmailStr
    username: str


class Token(BaseModel):
    """Schema for token return."""

    access_token: str
    token_type: str = "bearer"
    refresh_token: str
    expires_in: int
    refresh_expires_in: int


class RefreshRequest(BaseModel):
    """Opaque refresh credentials must be sent in the JSON body, never URLs."""

    model_config = ConfigDict(extra="forbid")
    refresh_token: str = Field(min_length=40, max_length=256)
