"""Import the necessary libraries for workspaces schemas implementation."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

# Requests


class WorkspaceCreation(BaseModel):
    """Schema for workspace creation."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    name: str = Field(min_length=2, max_length=50)


class WorkspaceUpdate(BaseModel):
    """Schema for workspace update."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    name: str | None = Field(default=None, min_length=2, max_length=50)


# Responses


class WorkspaceOut(BaseModel):
    """Schema for returning the workspace to the frontend."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    created_at: datetime


class WorkspaceListOut(BaseModel):
    """Schema for returning a list of workspaces to the frontend."""

    model_config = ConfigDict(from_attributes=True)

    workspaces: list[WorkspaceOut]
