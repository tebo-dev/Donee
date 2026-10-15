"""Import the necessary libraries for tasks schemas implementation."""

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.tag.tag import TagListOut, TagPatch

# Requests


class TaskCreate(BaseModel):
    """Schema for task creation."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    title: str = Field(min_length=2, max_length=80)
    description: str = Field(max_length=10000)
    priority: int
    due_at: date
    tags: TagPatch | None = None
    workspace_id: UUID


class TaskUpdate(BaseModel):
    """Schema for task update."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    title: str | None = Field(default=None, min_length=2, max_length=80)
    description: str | None = Field(default=None, max_length=10000)
    status: Literal["to do", "in_progress", "blocked", "done", "archived"] | None = None
    priority: int | None = None
    due_at: date | None = None
    tags: TagPatch | None = None

    @model_validator(mode="after")
    def reject_null_fields(self):
        """Reject any null fields."""

        for name in self.model_fields_set - {"tags"}:
            if getattr(self, name) is None:
                raise ValueError(f"{name} cannot be null")
        return self


# Responses


class TaskPreview(BaseModel):
    """Schema for returning a task preview."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    workspace_id: UUID
    status: str
    priority: int
    due_at: date
    tags: TagListOut = Field(default_factory=lambda: TagListOut(tags=[], total=0))


class TaskOut(BaseModel):
    """Schema for returning a task for the frontend."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    description: str
    status: str
    priority: int
    due_at: date
    tags: TagListOut = Field(default_factory=lambda: TagListOut(tags=[], total=0))
    completed_at: date | None
    workspace_id: UUID
    created_at: datetime
    updated_at: datetime


class TaskListOut(BaseModel):
    """Schema for returning a list of task previews to the frontend."""

    model_config = ConfigDict(from_attributes=True)

    tasks: list[TaskPreview]
    total: int
