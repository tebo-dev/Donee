"""Import the necessary libraries for workspace tags schemas implementation."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

# Requests


class TagCreate(BaseModel):
    """Schema for tag creation."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    name: str = Field(min_length=2, max_length=150)
    color: str = Field(min_length=3, max_length=7)


class TagEdit(BaseModel):
    """Schema for tag edition."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    name: str = Field(min_length=2, max_length=150)
    color: str = Field(min_length=3, max_length=7)


# Responses


class TagOut(BaseModel):
    """Schema for returning a tag."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    workspace_id: UUID
    name: str
    color: str
    created_at: datetime


class TagListOut(BaseModel):
    """Schema for returning a list of tags."""

    model_config = ConfigDict(from_attributes=True)

    tags: list[TagOut]
    total: int
