"""Import the necessary libraries for user schema creation."""

from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

# Requests


class UserCreate(BaseModel):
    """Schema to create an user."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    email: EmailStr
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    """Schema for user login."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

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
